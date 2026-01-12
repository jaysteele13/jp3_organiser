//! Library management commands.
//!
//! Handles library initialization, status queries, saving files to library,
//! soft delete, edit, and compaction operations.

use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;

use crate::models::{
    song_flags, AlbumEntry, ArtistEntry, AudioMetadata, LibraryHeader, LibraryInfo, ParsedAlbum,
    ParsedArtist, ParsedLibrary, ParsedSong, SaveToLibraryResult, SongEntry, StringTable,
    HEADER_SIZE,
};

// JP3 directory structure constants
const JP3_DIR: &str = "jp3";
const MUSIC_DIR: &str = "music";
const METADATA_DIR: &str = "metadata";
const PLAYLISTS_DIR: &str = "playlists";
const LIBRARY_BIN: &str = "library.bin";

/// Initialize the JP3 library directory structure.
///
/// Creates the following structure:
/// ```text
/// {base_path}/
///   jp3/
///     music/
///       00/           # First bucket for audio files
///     metadata/
///       library.bin   # Empty library header
///     playlists/
/// ```
#[tauri::command]
pub fn initialize_library(base_path: String) -> Result<String, String> {
    let base = Path::new(&base_path);

    if !base.exists() {
        return Err("Base path does not exist".to_string());
    }
    if !base.is_dir() {
        return Err("Base path is not a directory".to_string());
    }

    let jp3_path = base.join(JP3_DIR);
    let music_path = jp3_path.join(MUSIC_DIR);
    let metadata_path = jp3_path.join(METADATA_DIR);
    let playlists_path = jp3_path.join(PLAYLISTS_DIR);

    // Create main jp3 directory and subdirectories
    fs::create_dir_all(&jp3_path).map_err(|e| format!("Failed to create jp3 directory: {}", e))?;
    fs::create_dir_all(&music_path)
        .map_err(|e| format!("Failed to create music directory: {}", e))?;
    fs::create_dir_all(&metadata_path)
        .map_err(|e| format!("Failed to create metadata directory: {}", e))?;
    fs::create_dir_all(&playlists_path)
        .map_err(|e| format!("Failed to create playlists directory: {}", e))?;

    // Create initial music bucket (00/)
    let first_bucket = music_path.join("00");
    fs::create_dir_all(&first_bucket)
        .map_err(|e| format!("Failed to create initial music bucket: {}", e))?;

    // Create empty library.bin if it doesn't exist
    let library_bin_path = metadata_path.join(LIBRARY_BIN);
    if !library_bin_path.exists() {
        let header = LibraryHeader::new_empty();
        let mut file = fs::File::create(&library_bin_path)
            .map_err(|e| format!("Failed to create library.bin: {}", e))?;
        file.write_all(&header.to_bytes())
            .map_err(|e| format!("Failed to write library.bin header: {}", e))?;
    }

    Ok(jp3_path.to_string_lossy().to_string())
}

/// Get information about the current library structure.
#[tauri::command]
pub fn get_library_info(base_path: String) -> Result<LibraryInfo, String> {
    let base = Path::new(&base_path);
    let jp3_path = base.join(JP3_DIR);

    if !jp3_path.exists() {
        return Ok(LibraryInfo::uninitialized());
    }

    let music_path = jp3_path.join(MUSIC_DIR);
    let metadata_path = jp3_path.join(METADATA_DIR);
    let library_bin_path = metadata_path.join(LIBRARY_BIN);

    // Count music buckets
    let music_buckets = if music_path.exists() {
        fs::read_dir(&music_path)
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_dir())
                    .count() as u32
            })
            .unwrap_or(0)
    } else {
        0
    };

    Ok(LibraryInfo {
        initialized: true,
        jp3_path: Some(jp3_path.to_string_lossy().to_string()),
        music_buckets,
        has_library_bin: library_bin_path.exists(),
    })
}

/// Input for saving a file to the library.
/// Contains the source path and the final metadata (may be user-edited).
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileToSave {
    pub source_path: String,
    pub metadata: AudioMetadata,
}

/// Maximum files per music bucket.
const MAX_FILES_PER_BUCKET: usize = 256;

/// Existing library data loaded from library.bin for incremental updates.
struct ExistingLibraryData {
    string_table: StringTable,
    artists: Vec<ArtistEntry>,
    albums: Vec<AlbumEntry>,
    songs: Vec<SongEntry>,
    artist_map: HashMap<String, u32>,
    album_map: HashMap<String, u32>,
    /// Set of existing songs keyed by (title, artist_id, album_id) to detect duplicates
    song_set: HashSet<(u32, u32, u32)>,
    /// Map from (title_string_id, artist_id, album_id) to song_id for finding duplicate IDs
    song_id_map: HashMap<(u32, u32, u32), u32>,
}

/// Load existing library data from library.bin for merging with new songs.
fn load_existing_library_data(
    library_bin_path: &Path,
) -> Result<Option<ExistingLibraryData>, String> {
    if !library_bin_path.exists() {
        return Ok(None);
    }

    // Read entire file
    let mut file = fs::File::open(library_bin_path)
        .map_err(|e| format!("Failed to open library.bin: {}", e))?;
    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| format!("Failed to read library.bin: {}", e))?;

    // Check if file is too small (just header with no data)
    if data.len() < HEADER_SIZE as usize {
        return Ok(None);
    }

    // Parse header
    let header = LibraryHeader::from_bytes(&data).ok_or("Invalid library.bin header")?;

    // If no songs exist, return None (fresh library)
    if header.song_count == 0 {
        return Ok(None);
    }

    // Parse string table
    let strings = parse_string_table(
        &data,
        header.string_table_offset as usize,
        header.artist_table_offset as usize,
    )?;
    let string_table = StringTable::from_vec(strings.clone());

    // Parse raw artist table and rebuild ArtistEntry vec + map
    let raw_artists = parse_artist_table(
        &data,
        header.artist_table_offset as usize,
        header.artist_count as usize,
    )?;
    let mut artists: Vec<ArtistEntry> = Vec::with_capacity(raw_artists.len());
    let mut artist_map: HashMap<String, u32> = HashMap::new();
    for (id, raw) in raw_artists.iter().enumerate() {
        let name = strings
            .get(raw.name_string_id as usize)
            .cloned()
            .unwrap_or_default();
        artist_map.insert(name, id as u32);
        artists.push(ArtistEntry {
            name_string_id: raw.name_string_id,
        });
    }

    // Parse raw album table and rebuild AlbumEntry vec + map
    let raw_albums = parse_album_table(
        &data,
        header.album_table_offset as usize,
        header.album_count as usize,
    )?;
    let mut albums: Vec<AlbumEntry> = Vec::with_capacity(raw_albums.len());
    let mut album_map: HashMap<String, u32> = HashMap::new();
    for (id, raw) in raw_albums.iter().enumerate() {
        let album_name = strings
            .get(raw.name_string_id as usize)
            .cloned()
            .unwrap_or_default();
        let album_key = format!("{}:{}", raw.artist_id, album_name);
        album_map.insert(album_key, id as u32);
        albums.push(AlbumEntry {
            name_string_id: raw.name_string_id,
            artist_id: raw.artist_id,
            year: raw.year,
        });
    }

    // Parse raw song table and rebuild SongEntry vec + song_set for duplicate detection
    let raw_songs = parse_song_table(
        &data,
        header.song_table_offset as usize,
        header.song_count as usize,
    )?;
    let mut song_set: HashSet<(u32, u32, u32)> = HashSet::new();
    let mut song_id_map: HashMap<(u32, u32, u32), u32> = HashMap::new();
    let songs: Vec<SongEntry> = raw_songs
        .iter()
        .enumerate()
        .map(|(idx, raw)| {
            // Only add active (non-deleted) songs to the duplicate set and map
            if raw.flags & song_flags::DELETED == 0 {
                let song_key = (raw.title_string_id, raw.artist_id, raw.album_id);
                song_set.insert(song_key);
                song_id_map.insert(song_key, idx as u32);
            }
            SongEntry {
                title_string_id: raw.title_string_id,
                artist_id: raw.artist_id,
                album_id: raw.album_id,
                path_string_id: raw.path_string_id,
                track_number: raw.track_number,
                duration_sec: raw.duration_sec,
                flags: raw.flags,
            }
        })
        .collect();

    Ok(Some(ExistingLibraryData {
        string_table,
        artists,
        albums,
        songs,
        artist_map,
        album_map,
        song_set,
        song_id_map,
    }))
}

/// Save audio files to the library.
///
/// This command:
/// 1. Loads existing library data (if any) for incremental updates
/// 2. Copies audio files to the appropriate music bucket
/// 3. Merges new songs with existing library data
/// 4. Writes updated library.bin with all artists, albums, and songs
///
/// Files are added to existing library data (incremental).
#[tauri::command]
pub fn save_to_library(
    base_path: String,
    files: Vec<FileToSave>,
) -> Result<SaveToLibraryResult, String> {
    let base = Path::new(&base_path);
    let jp3_path = base.join(JP3_DIR);
    let music_path = jp3_path.join(MUSIC_DIR);
    let metadata_path = jp3_path.join(METADATA_DIR);
    let library_bin_path = metadata_path.join(LIBRARY_BIN);

    if !jp3_path.exists() {
        return Err(
            "Library not initialized. Please select a library directory first.".to_string(),
        );
    }

    // Load existing library data or start fresh
    let existing = load_existing_library_data(&library_bin_path)?;

    let (
        mut string_table,
        mut artists,
        mut albums,
        mut songs,
        mut artist_map,
        mut album_map,
        mut song_set,
        song_id_map,
    ) = match existing {
        Some(data) => (
            data.string_table,
            data.artists,
            data.albums,
            data.songs,
            data.artist_map,
            data.album_map,
            data.song_set,
            data.song_id_map,
        ),
        None => (
            StringTable::new(),
            Vec::new(),
            Vec::new(),
            Vec::new(),
            HashMap::new(),
            HashMap::new(),
            HashSet::new(),
            HashMap::new(),
        ),
    };

    let existing_song_count = songs.len() as u32;
    let existing_artist_count = artists.len() as u32;
    let existing_album_count = albums.len() as u32;

    // Find current bucket and file count
    let (mut current_bucket, mut files_in_bucket) = get_current_bucket(&music_path)?;

    let mut files_saved = 0u32;
    let mut duplicates_skipped = 0u32;
    let mut saved_song_ids: Vec<u32> = Vec::new();
    let mut duplicate_song_ids: Vec<u32> = Vec::new();

    for file_to_save in files {
        let source = Path::new(&file_to_save.source_path);
        if !source.exists() {
            continue; // Skip missing files
        }

        let metadata = &file_to_save.metadata;

        // Validate required fields
        let title = metadata.title.as_ref().ok_or("Missing title")?;
        let artist_name = metadata.artist.as_ref().ok_or("Missing artist")?;
        let album_name = metadata.album.as_ref().ok_or("Missing album")?;

        // Get or create artist
        let artist_id = if let Some(&id) = artist_map.get(artist_name) {
            id
        } else {
            let id = artists.len() as u32;
            let name_string_id = string_table.add(artist_name);
            artists.push(ArtistEntry { name_string_id });
            artist_map.insert(artist_name.clone(), id);
            id
        };

        // Get or create album (scoped to artist)
        let album_key = format!("{}:{}", artist_id, album_name);
        let album_id = if let Some(&id) = album_map.get(&album_key) {
            id
        } else {
            let id = albums.len() as u32;
            let name_string_id = string_table.add(album_name);
            albums.push(AlbumEntry {
                name_string_id,
                artist_id,
                year: metadata.year.unwrap_or(0) as u16,
            });
            album_map.insert(album_key, id);
            id
        };

        // Check for duplicate song (same title, artist, album)
        // We need to check using the title_string_id that would be assigned
        let title_string_id = string_table.get_or_peek(title);
        if let Some(tid) = title_string_id {
            let song_key = (tid, artist_id, album_id);
            if song_set.contains(&song_key) {
                log::info!(
                    "Skipping duplicate song: '{}' by '{}' on '{}'",
                    title,
                    artist_name,
                    album_name
                );
                // Look up the existing song's ID and add to duplicate_song_ids
                // This allows the frontend to add duplicates to playlists
                if let Some(&existing_song_id) = song_id_map.get(&song_key) {
                    duplicate_song_ids.push(existing_song_id);
                }
                duplicates_skipped += 1;
                continue;
            }
        }

        // Check if we need a new bucket
        if files_in_bucket >= MAX_FILES_PER_BUCKET {
            current_bucket += 1;
            files_in_bucket = 0;
            let new_bucket_path = music_path.join(format!("{:02}", current_bucket));
            fs::create_dir_all(&new_bucket_path)
                .map_err(|e| format!("Failed to create bucket {:02}: {}", current_bucket, e))?;
        }

        // Get file extension from source
        let extension = source
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("mp3")
            .to_lowercase();

        // Generate sequential filename: 001.mp3, 002.mp3, etc.
        let new_filename = format!("{:03}.{}", files_in_bucket + 1, extension);
        let relative_path = format!("{:02}/{}", current_bucket, new_filename);
        let dest_path = music_path.join(&relative_path);

        // Copy file with new name
        fs::copy(source, &dest_path)
            .map_err(|e| format!("Failed to copy to {}: {}", relative_path, e))?;

        // Add song entry
        let title_string_id = string_table.add(title);
        let path_string_id = string_table.add(&relative_path);

        // Add to song_set to prevent duplicates within the same batch
        let song_key = (title_string_id, artist_id, album_id);
        song_set.insert(song_key);

        // Track the song ID before adding
        let new_song_id = songs.len() as u32;

        songs.push(SongEntry::new(
            title_string_id,
            artist_id,
            album_id,
            path_string_id,
            metadata.track_number.unwrap_or(0) as u16,
            metadata.duration_secs.unwrap_or(0) as u16,
        ));

        saved_song_ids.push(new_song_id);
        files_in_bucket += 1;
        files_saved += 1;
    }

    // Build library.bin
    let string_table_bytes = string_table.to_bytes();
    let artist_table_bytes: Vec<u8> = artists.iter().flat_map(|a| a.to_bytes()).collect();
    let album_table_bytes: Vec<u8> = albums.iter().flat_map(|a| a.to_bytes()).collect();
    let song_table_bytes: Vec<u8> = songs.iter().flat_map(|s| s.to_bytes()).collect();

    // Calculate offsets
    let string_table_offset = HEADER_SIZE;
    let artist_table_offset = string_table_offset + string_table_bytes.len() as u32;
    let album_table_offset = artist_table_offset + artist_table_bytes.len() as u32;
    let song_table_offset = album_table_offset + album_table_bytes.len() as u32;

    let header = LibraryHeader {
        magic: *crate::models::LIBRARY_MAGIC,
        version: crate::models::LIBRARY_VERSION,
        song_count: songs.len() as u32,
        artist_count: artists.len() as u32,
        album_count: albums.len() as u32,
        string_table_offset,
        artist_table_offset,
        album_table_offset,
        song_table_offset,
    };

    // Write library.bin
    let mut file = fs::File::create(&library_bin_path)
        .map_err(|e| format!("Failed to create library.bin: {}", e))?;
    file.write_all(&header.to_bytes())
        .map_err(|e| format!("Failed to write header: {}", e))?;
    file.write_all(&string_table_bytes)
        .map_err(|e| format!("Failed to write string table: {}", e))?;
    file.write_all(&artist_table_bytes)
        .map_err(|e| format!("Failed to write artist table: {}", e))?;
    file.write_all(&album_table_bytes)
        .map_err(|e| format!("Failed to write album table: {}", e))?;
    file.write_all(&song_table_bytes)
        .map_err(|e| format!("Failed to write song table: {}", e))?;

    Ok(SaveToLibraryResult {
        files_saved,
        artists_added: artists.len() as u32 - existing_artist_count,
        albums_added: albums.len() as u32 - existing_album_count,
        songs_added: songs.len() as u32 - existing_song_count,
        duplicates_skipped,
        song_ids: saved_song_ids,
        duplicate_song_ids,
    })
}

/// Soft delete songs by their IDs.
///
/// This modifies the flags byte of each song entry (minimal binary write),
/// AND deletes the actual audio file from music/ (frees disk space immediately).
/// Use `compact_library` to reclaim metadata space in library.bin.
#[tauri::command]
pub fn delete_songs(
    base_path: String,
    song_ids: Vec<u32>,
) -> Result<crate::models::DeleteSongsResult, String> {
    let base = Path::new(&base_path);
    let jp3_path = base.join(JP3_DIR);
    let metadata_path = jp3_path.join(METADATA_DIR);
    let music_path = jp3_path.join(MUSIC_DIR);
    let library_bin_path = metadata_path.join(LIBRARY_BIN);

    if !library_bin_path.exists() {
        return Err("Library not found".to_string());
    }

    // Read entire file to get string table for path resolution
    let mut data = Vec::new();
    {
        let mut read_file = fs::File::open(&library_bin_path)
            .map_err(|e| format!("Failed to open library.bin for reading: {}", e))?;
        read_file
            .read_to_end(&mut data)
            .map_err(|e| format!("Failed to read library.bin: {}", e))?;
    }

    let header = LibraryHeader::from_bytes(&data).ok_or("Invalid library.bin header")?;

    // Parse string table to resolve paths
    let strings = parse_string_table(
        &data,
        header.string_table_offset as usize,
        header.artist_table_offset as usize,
    )?;

    // Open file for writing flags
    let mut file = OpenOptions::new()
        .read(true)
        .write(true)
        .open(&library_bin_path)
        .map_err(|e| format!("Failed to open library.bin for writing: {}", e))?;

    let mut songs_deleted = 0u32;
    let mut not_found = Vec::new();
    let mut files_deleted = 0u32;

    for &song_id in &song_ids {
        if song_id >= header.song_count {
            not_found.push(song_id);
            continue;
        }

        // Calculate song entry offset
        let song_offset =
            header.song_table_offset as usize + (song_id as usize * SongEntry::SIZE as usize);

        // Read the path_string_id (bytes 12-16 of the song entry)
        let path_string_id = u32::from_le_bytes(
            data[song_offset + 12..song_offset + 16]
                .try_into()
                .map_err(|_| format!("Failed to read path_string_id for song {}", song_id))?,
        );

        // Get the audio file path from string table
        if let Some(audio_path_str) = strings.get(path_string_id as usize) {
            let audio_file_path = music_path.join(audio_path_str);
            if audio_file_path.exists() {
                if fs::remove_file(&audio_file_path).is_ok() {
                    files_deleted += 1;
                }
            }
        }

        // Mark song as deleted in library.bin (flags byte at offset 20)
        let flags_offset = song_offset as u64 + 20;
        file.seek(SeekFrom::Start(flags_offset))
            .map_err(|e| format!("Failed to seek to song {}: {}", song_id, e))?;

        file.write_all(&[song_flags::DELETED])
            .map_err(|e| format!("Failed to mark song {} as deleted: {}", song_id, e))?;

        songs_deleted += 1;
    }

    // Ensure changes are flushed to disk
    file.sync_all()
        .map_err(|e| format!("Failed to sync changes: {}", e))?;

    // Note: Playlists are NOT updated here to minimize SD card writes.
    // Orphaned song IDs in playlists will be cleaned up during compact_library,
    // which also remaps all song IDs. The frontend filters orphaned IDs when displaying.

    Ok(crate::models::DeleteSongsResult {
        songs_deleted,
        not_found,
        files_deleted,
    })
}

/// Remap a song ID in all playlists.
///
/// Scans all playlist files and replaces occurrences of `old_id` with `new_id`.
/// Returns the number of playlists that were updated.
fn remap_song_id_in_playlists(jp3_path: &Path, old_id: u32, new_id: u32) -> Result<u32, String> {
    use crate::commands::playlist::{read_playlist_file, write_playlist_file};

    let playlists_path = jp3_path.join(PLAYLISTS_DIR);

    if !playlists_path.exists() {
        return Ok(0);
    }

    let entries = fs::read_dir(&playlists_path)
        .map_err(|e| format!("Failed to read playlists directory: {}", e))?;

    let mut playlists_updated = 0u32;

    for entry in entries.flatten() {
        let path = entry.path();

        // Skip non-.bin files
        if path.extension().and_then(|e| e.to_str()) != Some("bin") {
            continue;
        }

        // Extract playlist ID from filename
        let playlist_id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .and_then(|s| s.parse::<u32>().ok());

        let playlist_id = match playlist_id {
            Some(id) => id,
            None => continue,
        };

        // Read playlist
        let playlist = match read_playlist_file(&path, playlist_id) {
            Ok(p) => p,
            Err(_) => continue, // Skip corrupted playlists
        };

        // Check if this playlist contains the old ID
        if !playlist.song_ids.contains(&old_id) {
            continue;
        }

        // Remap old_id to new_id
        let updated_song_ids: Vec<u32> = playlist
            .song_ids
            .iter()
            .map(|&id| if id == old_id { new_id } else { id })
            .collect();

        // Write updated playlist
        write_playlist_file(&path, &playlist.name, &updated_song_ids)?;
        playlists_updated += 1;
    }

    Ok(playlists_updated)
}

/// Edit a song's metadata by soft-deleting the old entry and appending a new one.
///
/// This approach minimizes write cycles by:
/// 1. Marking the old song entry as deleted (1 byte write)
/// 2. Appending new strings/entries to the end of the file
///
/// Note: This does require a full file rewrite since we need to update offsets.
/// For truly minimal writes, use delete_songs + save_to_library separately.
#[tauri::command]
pub fn edit_song_metadata(
    base_path: String,
    song_id: u32,
    new_metadata: AudioMetadata,
) -> Result<crate::models::EditSongResult, String> {
    // First, soft delete the old song
    let delete_result = delete_songs(base_path.clone(), vec![song_id])?;

    if delete_result.songs_deleted == 0 {
        return Err(format!("Song {} not found", song_id));
    }

    // Load existing library to get the old song's path
    let base = Path::new(&base_path);
    let jp3_path = base.join(JP3_DIR);
    let metadata_path = jp3_path.join(METADATA_DIR);
    let library_bin_path = metadata_path.join(LIBRARY_BIN);

    // Read the file to get the old song's path
    let mut file = fs::File::open(&library_bin_path)
        .map_err(|e| format!("Failed to open library.bin: {}", e))?;
    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| format!("Failed to read library.bin: {}", e))?;

    let header = LibraryHeader::from_bytes(&data).ok_or("Invalid library.bin header")?;

    // Parse string table to get the old path
    let strings = parse_string_table(
        &data,
        header.string_table_offset as usize,
        header.artist_table_offset as usize,
    )?;

    // Get the old song entry to preserve its path
    let song_offset =
        header.song_table_offset as usize + (song_id as usize * SongEntry::SIZE as usize);
    let old_path_string_id = u32::from_le_bytes(
        data[song_offset + 12..song_offset + 16]
            .try_into()
            .map_err(|_| "Failed to read path_string_id")?,
    );
    let old_path = strings
        .get(old_path_string_id as usize)
        .cloned()
        .ok_or("Failed to get old song path")?;

    // Load existing library data for the append
    let existing = load_existing_library_data(&library_bin_path)?
        .ok_or("Failed to load existing library data")?;

    let mut string_table = existing.string_table;
    let mut artists = existing.artists;
    let mut albums = existing.albums;
    let mut songs = existing.songs;
    let mut artist_map = existing.artist_map;
    let mut album_map = existing.album_map;

    let old_artist_count = artists.len();
    let old_album_count = albums.len();

    // Get or create artist
    let artist_name = new_metadata.artist.as_ref().ok_or("Missing artist")?;
    let artist_id = if let Some(&id) = artist_map.get(artist_name) {
        id
    } else {
        let id = artists.len() as u32;
        let name_string_id = string_table.add(artist_name);
        artists.push(ArtistEntry { name_string_id });
        artist_map.insert(artist_name.clone(), id);
        id
    };

    // Get or create album
    let album_name = new_metadata.album.as_ref().ok_or("Missing album")?;
    let album_key = format!("{}:{}", artist_id, album_name);
    let album_id = if let Some(&id) = album_map.get(&album_key) {
        id
    } else {
        let id = albums.len() as u32;
        let name_string_id = string_table.add(album_name);
        albums.push(AlbumEntry {
            name_string_id,
            artist_id,
            year: new_metadata.year.unwrap_or(0) as u16,
        });
        album_map.insert(album_key, id);
        id
    };

    // Create new song entry with same path but new metadata
    let title = new_metadata.title.as_ref().ok_or("Missing title")?;
    let title_string_id = string_table.add(title);
    let path_string_id = string_table.add(&old_path); // Reuse path, dedup handles it

    let new_song_id = songs.len() as u32;
    songs.push(SongEntry::new(
        title_string_id,
        artist_id,
        album_id,
        path_string_id,
        new_metadata.track_number.unwrap_or(0) as u16,
        new_metadata.duration_secs.unwrap_or(0) as u16,
    ));

    // Rebuild and write library.bin
    write_library_bin(&library_bin_path, &string_table, &artists, &albums, &songs)?;

    // Remap old song ID to new song ID in all playlists
    let playlists_updated = remap_song_id_in_playlists(&jp3_path, song_id, new_song_id)?;

    Ok(crate::models::EditSongResult {
        new_song_id,
        artist_created: artists.len() > old_artist_count,
        album_created: albums.len() > old_album_count,
        playlists_updated,
    })
}

/// Get library statistics including deleted song count.
///
/// Use this to determine if compaction is needed.
#[tauri::command]
pub fn get_library_stats(base_path: String) -> Result<crate::models::LibraryStats, String> {
    let base = Path::new(&base_path);
    let jp3_path = base.join(JP3_DIR);
    let metadata_path = jp3_path.join(METADATA_DIR);
    let library_bin_path = metadata_path.join(LIBRARY_BIN);

    if !library_bin_path.exists() {
        return Err("Library not found".to_string());
    }

    let file_size_bytes = fs::metadata(&library_bin_path)
        .map(|m| m.len())
        .unwrap_or(0);

    let mut file = fs::File::open(&library_bin_path)
        .map_err(|e| format!("Failed to open library.bin: {}", e))?;
    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| format!("Failed to read library.bin: {}", e))?;

    let header = LibraryHeader::from_bytes(&data).ok_or("Invalid library.bin header")?;

    // Count strings
    let strings = parse_string_table(
        &data,
        header.string_table_offset as usize,
        header.artist_table_offset as usize,
    )?;

    // Parse songs to count active vs deleted
    let raw_songs = parse_song_table(
        &data,
        header.song_table_offset as usize,
        header.song_count as usize,
    )?;

    let deleted_songs = raw_songs
        .iter()
        .filter(|s| s.flags & song_flags::DELETED != 0)
        .count() as u32;
    let active_songs = header.song_count - deleted_songs;

    let deleted_percentage = if header.song_count > 0 {
        (deleted_songs as f32 / header.song_count as f32) * 100.0
    } else {
        0.0
    };

    Ok(crate::models::LibraryStats {
        total_songs: header.song_count,
        active_songs,
        deleted_songs,
        total_artists: header.artist_count,
        total_albums: header.album_count,
        total_strings: strings.len() as u32,
        deleted_percentage,
        should_compact: deleted_percentage > 20.0,
        file_size_bytes,
    })
}

/// Compact the library by removing deleted entries and orphaned data.
///
/// This rebuilds the entire library.bin, removing:
/// - Soft-deleted songs
/// - Artists with no remaining songs
/// - Albums with no remaining songs  
/// - Strings not referenced by any active entry
///
/// This is a full rewrite operation - use sparingly to minimize SD card wear.
#[tauri::command]
pub fn compact_library(base_path: String) -> Result<crate::models::CompactResult, String> {
    let base = Path::new(&base_path);
    let jp3_path = base.join(JP3_DIR);
    let metadata_path = jp3_path.join(METADATA_DIR);
    let music_path = jp3_path.join(MUSIC_DIR);
    let library_bin_path = metadata_path.join(LIBRARY_BIN);

    if !library_bin_path.exists() {
        return Err("Library not found".to_string());
    }

    let old_size_bytes = fs::metadata(&library_bin_path)
        .map(|m| m.len())
        .unwrap_or(0);

    // Load existing data
    let mut file = fs::File::open(&library_bin_path)
        .map_err(|e| format!("Failed to open library.bin: {}", e))?;
    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| format!("Failed to read library.bin: {}", e))?;

    let header = LibraryHeader::from_bytes(&data).ok_or("Invalid library.bin header")?;

    // Parse all data
    let old_strings = parse_string_table(
        &data,
        header.string_table_offset as usize,
        header.artist_table_offset as usize,
    )?;

    let old_artists = parse_artist_table(
        &data,
        header.artist_table_offset as usize,
        header.artist_count as usize,
    )?;

    let old_albums = parse_album_table(
        &data,
        header.album_table_offset as usize,
        header.album_count as usize,
    )?;

    let old_songs = parse_song_table(
        &data,
        header.song_table_offset as usize,
        header.song_count as usize,
    )?;

    // Count what we're removing
    let songs_removed = old_songs
        .iter()
        .filter(|s| s.flags & song_flags::DELETED != 0)
        .count() as u32;

    // Filter to only active songs
    let active_songs: Vec<_> = old_songs
        .iter()
        .filter(|s| s.flags & song_flags::DELETED == 0)
        .collect();

    // Find which artists and albums are still referenced
    let used_artist_ids: HashSet<u32> = active_songs.iter().map(|s| s.artist_id).collect();
    let used_album_ids: HashSet<u32> = active_songs.iter().map(|s| s.album_id).collect();

    // Build new tables with fresh IDs
    let mut new_string_table = StringTable::new();
    let mut new_artists: Vec<ArtistEntry> = Vec::new();
    let mut new_albums: Vec<AlbumEntry> = Vec::new();
    let mut new_songs: Vec<SongEntry> = Vec::new();

    // Map old IDs to new IDs
    let mut artist_id_map: HashMap<u32, u32> = HashMap::new();
    let mut album_id_map: HashMap<u32, u32> = HashMap::new();

    // Rebuild artists (only those still used)
    for (old_id, artist) in old_artists.iter().enumerate() {
        if used_artist_ids.contains(&(old_id as u32)) {
            let new_id = new_artists.len() as u32;
            let name = old_strings
                .get(artist.name_string_id as usize)
                .cloned()
                .unwrap_or_default();
            let name_string_id = new_string_table.add(&name);
            new_artists.push(ArtistEntry { name_string_id });
            artist_id_map.insert(old_id as u32, new_id);
        }
    }

    // Rebuild albums (only those still used, with remapped artist IDs)
    for (old_id, album) in old_albums.iter().enumerate() {
        if used_album_ids.contains(&(old_id as u32)) {
            let new_id = new_albums.len() as u32;
            let name = old_strings
                .get(album.name_string_id as usize)
                .cloned()
                .unwrap_or_default();
            let name_string_id = new_string_table.add(&name);
            let new_artist_id = *artist_id_map.get(&album.artist_id).unwrap_or(&0);
            new_albums.push(AlbumEntry {
                name_string_id,
                artist_id: new_artist_id,
                year: album.year,
            });
            album_id_map.insert(old_id as u32, new_id);
        }
    }

    // Rebuild songs with remapped IDs
    // Also build a map from old song IDs to new song IDs for playlist remapping
    let mut song_id_map: HashMap<u32, u32> = HashMap::new();
    for (old_idx, song) in old_songs.iter().enumerate() {
        // Skip deleted songs
        if song.flags & song_flags::DELETED != 0 {
            continue;
        }

        let title = old_strings
            .get(song.title_string_id as usize)
            .cloned()
            .unwrap_or_default();
        let path = old_strings
            .get(song.path_string_id as usize)
            .cloned()
            .unwrap_or_default();

        let title_string_id = new_string_table.add(&title);
        let path_string_id = new_string_table.add(&path);
        let new_artist_id = *artist_id_map.get(&song.artist_id).unwrap_or(&0);
        let new_album_id = *album_id_map.get(&song.album_id).unwrap_or(&0);

        let new_song_id = new_songs.len() as u32;
        song_id_map.insert(old_idx as u32, new_song_id);

        new_songs.push(SongEntry::new(
            title_string_id,
            new_artist_id,
            new_album_id,
            path_string_id,
            song.track_number,
            song.duration_sec,
        ));
    }

    // Also delete the actual audio files for deleted songs
    for song in &old_songs {
        if song.flags & song_flags::DELETED != 0 {
            if let Some(path_str) = old_strings.get(song.path_string_id as usize) {
                let audio_path = music_path.join(path_str);
                if audio_path.exists() {
                    let _ = fs::remove_file(&audio_path); // Ignore errors
                }
            }
        }
    }

    // Calculate removed counts
    let artists_removed = header.artist_count - new_artists.len() as u32;
    let albums_removed = header.album_count - new_albums.len() as u32;
    let strings_removed = old_strings.len() as u32 - new_string_table.len() as u32;

    // Write new library.bin
    write_library_bin(
        &library_bin_path,
        &new_string_table,
        &new_artists,
        &new_albums,
        &new_songs,
    )?;

    let new_size_bytes = fs::metadata(&library_bin_path)
        .map(|m| m.len())
        .unwrap_or(0);

    // Remap song IDs in all playlists
    // This removes orphaned IDs (deleted songs) and updates IDs to new values
    let playlists_path = jp3_path.join(PLAYLISTS_DIR);
    let mut playlists_updated = 0u32;

    if playlists_path.exists() {
        if let Ok(entries) = fs::read_dir(&playlists_path) {
            for entry in entries.flatten() {
                // Parse playlist ID from filename (e.g., "123.bin" -> 123)
                let Some(playlist_id) = entry
                    .file_name()
                    .to_str()
                    .and_then(|name| name.strip_suffix(".bin"))
                    .and_then(|id_str| id_str.parse::<u32>().ok())
                else {
                    continue;
                };

                // Read the playlist
                let Ok(playlist) =
                    crate::commands::playlist::read_playlist_file(&entry.path(), playlist_id)
                else {
                    continue;
                };

                // Remap song IDs: keep only songs that exist in the new library
                // and update their IDs to the new values
                let remapped_ids: Vec<u32> = playlist
                    .song_ids
                    .iter()
                    .filter_map(|old_id| song_id_map.get(old_id).copied())
                    .collect();

                // Always rewrite since IDs may have changed even if count is same
                if crate::commands::playlist::write_playlist_file(
                    &entry.path(),
                    &playlist.name,
                    &remapped_ids,
                )
                .is_ok()
                {
                    playlists_updated += 1;
                }
            }
        }
    }

    Ok(crate::models::CompactResult {
        songs_removed,
        artists_removed,
        albums_removed,
        strings_removed,
        playlists_updated,
        old_size_bytes,
        new_size_bytes,
        bytes_saved: old_size_bytes.saturating_sub(new_size_bytes),
    })
}

/// Helper function to write library.bin from components.
fn write_library_bin(
    path: &Path,
    string_table: &StringTable,
    artists: &[ArtistEntry],
    albums: &[AlbumEntry],
    songs: &[SongEntry],
) -> Result<(), String> {
    let string_table_bytes = string_table.to_bytes();
    let artist_table_bytes: Vec<u8> = artists.iter().flat_map(|a| a.to_bytes()).collect();
    let album_table_bytes: Vec<u8> = albums.iter().flat_map(|a| a.to_bytes()).collect();
    let song_table_bytes: Vec<u8> = songs.iter().flat_map(|s| s.to_bytes()).collect();

    let string_table_offset = HEADER_SIZE;
    let artist_table_offset = string_table_offset + string_table_bytes.len() as u32;
    let album_table_offset = artist_table_offset + artist_table_bytes.len() as u32;
    let song_table_offset = album_table_offset + album_table_bytes.len() as u32;

    let header = LibraryHeader {
        magic: *crate::models::LIBRARY_MAGIC,
        version: crate::models::LIBRARY_VERSION,
        song_count: songs.len() as u32,
        artist_count: artists.len() as u32,
        album_count: albums.len() as u32,
        string_table_offset,
        artist_table_offset,
        album_table_offset,
        song_table_offset,
    };

    let mut file =
        fs::File::create(path).map_err(|e| format!("Failed to create library.bin: {}", e))?;
    file.write_all(&header.to_bytes())
        .map_err(|e| format!("Failed to write header: {}", e))?;
    file.write_all(&string_table_bytes)
        .map_err(|e| format!("Failed to write string table: {}", e))?;
    file.write_all(&artist_table_bytes)
        .map_err(|e| format!("Failed to write artist table: {}", e))?;
    file.write_all(&album_table_bytes)
        .map_err(|e| format!("Failed to write album table: {}", e))?;
    file.write_all(&song_table_bytes)
        .map_err(|e| format!("Failed to write song table: {}", e))?;
    file.sync_all()
        .map_err(|e| format!("Failed to sync: {}", e))?;

    Ok(())
}

/// Delete all songs belonging to an album.
///
/// This finds all songs with the given album_id and soft-deletes them,
/// also deleting their audio files from music/.
/// Use `compact_library` to clean up orphaned albums/artists afterward.
#[tauri::command]
pub fn delete_album(
    base_path: String,
    album_id: u32,
) -> Result<crate::models::DeleteAlbumResult, String> {
    // First load the library to find all songs in this album
    let library = load_library(base_path.clone())?;

    // Find the album to get its name
    let album = library
        .albums
        .iter()
        .find(|a| a.id == album_id)
        .ok_or_else(|| format!("Album with ID {} not found", album_id))?;

    let album_name = album.name.clone();
    let artist_name = album.artist_name.clone();

    // Find all songs in this album
    let song_ids: Vec<u32> = library
        .songs
        .iter()
        .filter(|s| s.album_id == album_id)
        .map(|s| s.id)
        .collect();

    if song_ids.is_empty() {
        return Ok(crate::models::DeleteAlbumResult {
            songs_deleted: 0,
            files_deleted: 0,
            album_name,
            artist_name,
        });
    }

    // Delete the songs using existing function
    let delete_result = delete_songs(base_path, song_ids)?;

    Ok(crate::models::DeleteAlbumResult {
        songs_deleted: delete_result.songs_deleted,
        files_deleted: delete_result.files_deleted,
        album_name,
        artist_name,
    })
}

/// Delete all songs belonging to an artist.
///
/// This finds all songs with the given artist_id and soft-deletes them,
/// also deleting their audio files from music/.
/// Use `compact_library` to clean up orphaned albums/artists afterward.
#[tauri::command]
pub fn delete_artist(
    base_path: String,
    artist_id: u32,
) -> Result<crate::models::DeleteArtistResult, String> {
    // First load the library to find all songs by this artist
    let library = load_library(base_path.clone())?;

    // Find the artist to get their name
    let artist = library
        .artists
        .iter()
        .find(|a| a.id == artist_id)
        .ok_or_else(|| format!("Artist with ID {} not found", artist_id))?;

    let artist_name = artist.name.clone();

    // Find all songs by this artist
    let song_ids: Vec<u32> = library
        .songs
        .iter()
        .filter(|s| s.artist_id == artist_id)
        .map(|s| s.id)
        .collect();

    // Count unique albums affected
    let albums_affected: u32 = library
        .songs
        .iter()
        .filter(|s| s.artist_id == artist_id)
        .map(|s| s.album_id)
        .collect::<std::collections::HashSet<_>>()
        .len() as u32;

    if song_ids.is_empty() {
        return Ok(crate::models::DeleteArtistResult {
            songs_deleted: 0,
            files_deleted: 0,
            albums_affected: 0,
            artist_name,
        });
    }

    // Delete the songs using existing function
    let delete_result = delete_songs(base_path, song_ids)?;

    Ok(crate::models::DeleteArtistResult {
        songs_deleted: delete_result.songs_deleted,
        files_deleted: delete_result.files_deleted,
        albums_affected,
        artist_name,
    })
}

/// Edit an album's metadata (name, year, or artist).
///
/// This updates all songs in the album to reflect the new album metadata.
/// If the artist changes, a new artist entry is created if needed.
/// This requires a full library rewrite.
#[tauri::command]
pub fn edit_album(
    base_path: String,
    album_id: u32,
    new_name: String,
    new_artist_name: String,
    new_year: Option<u16>,
) -> Result<crate::models::EditAlbumResult, String> {
    let base = Path::new(&base_path);
    let jp3_path = base.join(JP3_DIR);
    let metadata_path = jp3_path.join(METADATA_DIR);
    let library_bin_path = metadata_path.join(LIBRARY_BIN);

    if !library_bin_path.exists() {
        return Err("Library not found".to_string());
    }

    // Load existing library data
    let existing = load_existing_library_data(&library_bin_path)?
        .ok_or("Failed to load existing library data")?;

    let mut string_table = existing.string_table;
    let mut artists = existing.artists;
    let mut albums = existing.albums;
    let songs = existing.songs;
    let mut artist_map = existing.artist_map;
    let mut album_map = existing.album_map;

    // Find the album
    if album_id as usize >= albums.len() {
        return Err(format!("Album with ID {} not found", album_id));
    }

    // Get old album info for result
    let old_name_string_id = albums[album_id as usize].name_string_id;
    let old_name = string_table
        .get(old_name_string_id)
        .map(|s| s.to_string())
        .unwrap_or_default();
    let old_artist_id = albums[album_id as usize].artist_id;

    // Get or create the new artist
    let artist_created;
    let new_artist_id = if let Some(&id) = artist_map.get(&new_artist_name) {
        artist_created = false;
        id
    } else {
        artist_created = true;
        let id = artists.len() as u32;
        let name_string_id = string_table.add(&new_artist_name);
        artists.push(ArtistEntry { name_string_id });
        artist_map.insert(new_artist_name.clone(), id);
        id
    };

    // Remove old album key and add new one
    let old_album_key = format!("{}:{}", old_artist_id, old_name);
    album_map.remove(&old_album_key);

    let new_album_key = format!("{}:{}", new_artist_id, new_name);
    album_map.insert(new_album_key, album_id);

    // Update the album entry
    let new_name_string_id = string_table.add(&new_name);
    albums[album_id as usize] = AlbumEntry {
        name_string_id: new_name_string_id,
        artist_id: new_artist_id,
        year: new_year.unwrap_or(albums[album_id as usize].year),
    };

    // Update all songs in this album to point to the new artist
    let mut songs_updated = 0u32;
    let updated_songs: Vec<SongEntry> = songs
        .into_iter()
        .map(|mut song| {
            if song.album_id == album_id && song.flags & song_flags::DELETED == 0 {
                song.artist_id = new_artist_id;
                songs_updated += 1;
            }
            song
        })
        .collect();

    // Write updated library
    write_library_bin(
        &library_bin_path,
        &string_table,
        &artists,
        &albums,
        &updated_songs,
    )?;

    Ok(crate::models::EditAlbumResult {
        songs_updated,
        artist_created,
        old_name,
        new_name,
    })
}

/// Edit an artist's metadata (name only).
///
/// This updates the artist's name in the string table.
/// All songs and albums by this artist will automatically reflect the change
/// since they reference the artist by ID.
#[tauri::command]
pub fn edit_artist(
    base_path: String,
    artist_id: u32,
    new_name: String,
) -> Result<crate::models::EditArtistResult, String> {
    let base = Path::new(&base_path);
    let jp3_path = base.join(JP3_DIR);
    let metadata_path = jp3_path.join(METADATA_DIR);
    let library_bin_path = metadata_path.join(LIBRARY_BIN);

    if !library_bin_path.exists() {
        return Err("Library not found".to_string());
    }

    // Load existing library data
    let existing = load_existing_library_data(&library_bin_path)?
        .ok_or("Failed to load existing library data")?;

    let mut string_table = existing.string_table;
    let mut artists = existing.artists;
    let albums = existing.albums;
    let songs = existing.songs;
    let mut artist_map = existing.artist_map;

    // Find the artist
    if artist_id as usize >= artists.len() {
        return Err(format!("Artist with ID {} not found", artist_id));
    }

    // Get old artist name for result
    let old_name_string_id = artists[artist_id as usize].name_string_id;
    let old_name = string_table
        .get(old_name_string_id)
        .map(|s| s.to_string())
        .unwrap_or_default();

    // Check if new name already exists (would cause a conflict)
    if let Some(&existing_id) = artist_map.get(&new_name) {
        if existing_id != artist_id {
            return Err(format!(
                "An artist named '{}' already exists. Cannot rename.",
                new_name
            ));
        }
    }

    // Update the artist map
    artist_map.remove(&old_name);
    artist_map.insert(new_name.clone(), artist_id);

    // Update the artist entry with new name
    let new_name_string_id = string_table.add(&new_name);
    artists[artist_id as usize] = ArtistEntry {
        name_string_id: new_name_string_id,
    };

    // Count affected songs and albums
    let songs_affected = songs
        .iter()
        .filter(|s| s.artist_id == artist_id && s.flags & song_flags::DELETED == 0)
        .count() as u32;

    let albums_affected = albums.iter().filter(|a| a.artist_id == artist_id).count() as u32;

    // Write updated library
    write_library_bin(&library_bin_path, &string_table, &artists, &albums, &songs)?;

    Ok(crate::models::EditArtistResult {
        songs_affected,
        albums_affected,
        old_name,
        new_name,
    })
}

/// Get the current bucket index and file count.
fn get_current_bucket(music_path: &Path) -> Result<(u32, usize), String> {
    if !music_path.exists() {
        return Ok((0, 0));
    }

    let mut max_bucket = 0u32;
    let entries =
        fs::read_dir(music_path).map_err(|e| format!("Failed to read music directory: {}", e))?;

    for entry in entries.flatten() {
        if entry.path().is_dir() {
            if let Some(name) = entry.file_name().to_str() {
                if let Ok(num) = name.parse::<u32>() {
                    max_bucket = max_bucket.max(num);
                }
            }
        }
    }

    // Count files in the current bucket
    let bucket_path = music_path.join(format!("{:02}", max_bucket));
    let file_count = if bucket_path.exists() {
        fs::read_dir(&bucket_path)
            .map(|entries| entries.flatten().filter(|e| e.path().is_file()).count())
            .unwrap_or(0)
    } else {
        0
    };

    Ok((max_bucket, file_count))
}

/// Load and parse library.bin from the jp3 folder.
///
/// This parses the binary format exactly as the ESP32 would,
/// reading directly from the file on disk (not from memory).
#[tauri::command]
pub fn load_library(base_path: String) -> Result<ParsedLibrary, String> {
    let base = Path::new(&base_path);
    let jp3_path = base.join(JP3_DIR);
    let metadata_path = jp3_path.join(METADATA_DIR);
    let library_bin_path = metadata_path.join(LIBRARY_BIN);

    if !library_bin_path.exists() {
        return Err("library.bin not found. Add some songs first.".to_string());
    }

    // Read entire file into memory (same as ESP32 would read from SD card)
    let mut file = fs::File::open(&library_bin_path)
        .map_err(|e| format!("Failed to open library.bin: {}", e))?;
    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| format!("Failed to read library.bin: {}", e))?;

    // Parse header
    let header = LibraryHeader::from_bytes(&data).ok_or("Invalid library.bin header")?;

    // Parse string table
    let strings = parse_string_table(
        &data,
        header.string_table_offset as usize,
        header.artist_table_offset as usize,
    )?;

    // Parse artist table
    let raw_artists = parse_artist_table(
        &data,
        header.artist_table_offset as usize,
        header.artist_count as usize,
    )?;

    // Parse album table
    let raw_albums = parse_album_table(
        &data,
        header.album_table_offset as usize,
        header.album_count as usize,
    )?;

    // Parse song table
    let raw_songs = parse_song_table(
        &data,
        header.song_table_offset as usize,
        header.song_count as usize,
    )?;

    // Build parsed artists with resolved names
    let artists: Vec<ParsedArtist> = raw_artists
        .iter()
        .enumerate()
        .map(|(i, a)| ParsedArtist {
            id: i as u32,
            name: strings
                .get(a.name_string_id as usize)
                .cloned()
                .unwrap_or_else(|| "Unknown".to_string()),
        })
        .collect();

    // Build parsed albums with resolved names
    let albums: Vec<ParsedAlbum> = raw_albums
        .iter()
        .enumerate()
        .map(|(i, a)| {
            let artist_name = artists
                .get(a.artist_id as usize)
                .map(|ar| ar.name.clone())
                .unwrap_or_else(|| "Unknown".to_string());
            ParsedAlbum {
                id: i as u32,
                name: strings
                    .get(a.name_string_id as usize)
                    .cloned()
                    .unwrap_or_else(|| "Unknown".to_string()),
                artist_id: a.artist_id,
                artist_name,
                year: a.year,
            }
        })
        .collect();

    // Build parsed songs with resolved names (skip deleted entries)
    let songs: Vec<ParsedSong> = raw_songs
        .iter()
        .enumerate()
        .filter(|(_, s)| s.flags & crate::models::song_flags::DELETED == 0)
        .map(|(i, s)| {
            let artist_name = artists
                .get(s.artist_id as usize)
                .map(|ar| ar.name.clone())
                .unwrap_or_else(|| "Unknown".to_string());
            let album_name = albums
                .get(s.album_id as usize)
                .map(|al| al.name.clone())
                .unwrap_or_else(|| "Unknown".to_string());
            ParsedSong {
                id: i as u32,
                title: strings
                    .get(s.title_string_id as usize)
                    .cloned()
                    .unwrap_or_else(|| "Unknown".to_string()),
                artist_id: s.artist_id,
                artist_name,
                album_id: s.album_id,
                album_name,
                path: strings
                    .get(s.path_string_id as usize)
                    .cloned()
                    .unwrap_or_else(|| "".to_string()),
                track_number: s.track_number,
                duration_sec: s.duration_sec,
            }
        })
        .collect();

    // Collect IDs of artists and albums that have at least one active song
    let active_artist_ids: HashSet<u32> = songs.iter().map(|s| s.artist_id).collect();
    let active_album_ids: HashSet<u32> = songs.iter().map(|s| s.album_id).collect();

    // Filter artists to only those with active songs
    let filtered_artists: Vec<ParsedArtist> = artists
        .into_iter()
        .filter(|a| active_artist_ids.contains(&a.id))
        .collect();

    // Filter albums to only those with active songs
    let filtered_albums: Vec<ParsedAlbum> = albums
        .into_iter()
        .filter(|a| active_album_ids.contains(&a.id))
        .collect();

    Ok(ParsedLibrary {
        version: header.version,
        artists: filtered_artists,
        albums: filtered_albums,
        songs,
    })
}

/// Parse the string table from binary data.
fn parse_string_table(data: &[u8], start: usize, end: usize) -> Result<Vec<String>, String> {
    let mut strings = Vec::new();
    let mut pos = start;

    while pos + 2 <= end && pos + 2 <= data.len() {
        let len = u16::from_le_bytes(
            data[pos..pos + 2]
                .try_into()
                .map_err(|_| "Failed to read string length")?,
        ) as usize;
        pos += 2;

        if pos + len > data.len() {
            return Err("String extends beyond file".to_string());
        }

        let s = String::from_utf8(data[pos..pos + len].to_vec())
            .map_err(|_| "Invalid UTF-8 in string table")?;
        strings.push(s);
        pos += len;
    }

    Ok(strings)
}

/// Raw artist entry from binary (before name resolution).
struct RawArtist {
    name_string_id: u32,
}

/// Parse artist table from binary data.
fn parse_artist_table(data: &[u8], start: usize, count: usize) -> Result<Vec<RawArtist>, String> {
    let mut artists = Vec::with_capacity(count);
    let entry_size = ArtistEntry::SIZE as usize;

    for i in 0..count {
        let offset = start + i * entry_size;
        if offset + 4 > data.len() {
            return Err("Artist table extends beyond file".to_string());
        }
        let name_string_id = u32::from_le_bytes(
            data[offset..offset + 4]
                .try_into()
                .map_err(|_| "Failed to read artist name_string_id")?,
        );
        artists.push(RawArtist { name_string_id });
    }

    Ok(artists)
}

/// Raw album entry from binary (before name resolution).
struct RawAlbum {
    name_string_id: u32,
    artist_id: u32,
    year: u16,
}

/// Parse album table from binary data.
fn parse_album_table(data: &[u8], start: usize, count: usize) -> Result<Vec<RawAlbum>, String> {
    let mut albums = Vec::with_capacity(count);
    let entry_size = AlbumEntry::SIZE as usize;

    for i in 0..count {
        let offset = start + i * entry_size;
        if offset + 10 > data.len() {
            return Err("Album table extends beyond file".to_string());
        }
        let name_string_id = u32::from_le_bytes(
            data[offset..offset + 4]
                .try_into()
                .map_err(|_| "Failed to read album name_string_id")?,
        );
        let artist_id = u32::from_le_bytes(
            data[offset + 4..offset + 8]
                .try_into()
                .map_err(|_| "Failed to read album artist_id")?,
        );
        let year = u16::from_le_bytes(
            data[offset + 8..offset + 10]
                .try_into()
                .map_err(|_| "Failed to read album year")?,
        );
        albums.push(RawAlbum {
            name_string_id,
            artist_id,
            year,
        });
    }

    Ok(albums)
}

/// Raw song entry from binary (before name resolution).
struct RawSong {
    title_string_id: u32,
    artist_id: u32,
    album_id: u32,
    path_string_id: u32,
    track_number: u16,
    duration_sec: u16,
    flags: u8,
}

/// Parse song table from binary data.
fn parse_song_table(data: &[u8], start: usize, count: usize) -> Result<Vec<RawSong>, String> {
    let mut songs = Vec::with_capacity(count);
    let entry_size = SongEntry::SIZE as usize;

    for i in 0..count {
        let offset = start + i * entry_size;
        if offset + 21 > data.len() {
            return Err("Song table extends beyond file".to_string());
        }
        let title_string_id = u32::from_le_bytes(
            data[offset..offset + 4]
                .try_into()
                .map_err(|_| "Failed to read song title_string_id")?,
        );
        let artist_id = u32::from_le_bytes(
            data[offset + 4..offset + 8]
                .try_into()
                .map_err(|_| "Failed to read song artist_id")?,
        );
        let album_id = u32::from_le_bytes(
            data[offset + 8..offset + 12]
                .try_into()
                .map_err(|_| "Failed to read song album_id")?,
        );
        let path_string_id = u32::from_le_bytes(
            data[offset + 12..offset + 16]
                .try_into()
                .map_err(|_| "Failed to read song path_string_id")?,
        );
        let track_number = u16::from_le_bytes(
            data[offset + 16..offset + 18]
                .try_into()
                .map_err(|_| "Failed to read song track_number")?,
        );
        let duration_sec = u16::from_le_bytes(
            data[offset + 18..offset + 20]
                .try_into()
                .map_err(|_| "Failed to read song duration_sec")?,
        );
        let flags = data[offset + 20];
        songs.push(RawSong {
            title_string_id,
            artist_id,
            album_id,
            path_string_id,
            track_number,
            duration_sec,
            flags,
        });
    }

    Ok(songs)
}
