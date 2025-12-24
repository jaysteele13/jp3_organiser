//! Library management commands.
//!
//! Handles library initialization, status queries, saving files to library,
//! soft delete, edit, and compaction operations.

use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;

use crate::models::{
    AlbumEntry, ArtistEntry, AudioMetadata, LibraryHeader, LibraryInfo, ParsedAlbum,
    ParsedArtist, ParsedLibrary, ParsedSong, SaveToLibraryResult, SongEntry, StringTable,
    HEADER_SIZE, song_flags,
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
    fs::create_dir_all(&jp3_path)
        .map_err(|e| format!("Failed to create jp3 directory: {}", e))?;
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
}

/// Load existing library data from library.bin for merging with new songs.
fn load_existing_library_data(library_bin_path: &Path) -> Result<Option<ExistingLibraryData>, String> {
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
    let header = LibraryHeader::from_bytes(&data)
        .ok_or("Invalid library.bin header")?;

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
        let name = strings.get(raw.name_string_id as usize)
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
        let album_name = strings.get(raw.name_string_id as usize)
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

    // Parse raw song table and rebuild SongEntry vec
    let raw_songs = parse_song_table(
        &data,
        header.song_table_offset as usize,
        header.song_count as usize,
    )?;
    let songs: Vec<SongEntry> = raw_songs.iter().map(|raw| SongEntry {
        title_string_id: raw.title_string_id,
        artist_id: raw.artist_id,
        album_id: raw.album_id,
        path_string_id: raw.path_string_id,
        track_number: raw.track_number,
        duration_sec: raw.duration_sec,
        flags: raw.flags,
    }).collect();

    Ok(Some(ExistingLibraryData {
        string_table,
        artists,
        albums,
        songs,
        artist_map,
        album_map,
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
        return Err("Library not initialized. Please select a library directory first.".to_string());
    }

    // Load existing library data or start fresh
    let existing = load_existing_library_data(&library_bin_path)?;
    
    let (mut string_table, mut artists, mut albums, mut songs, mut artist_map, mut album_map) = 
        match existing {
            Some(data) => (
                data.string_table,
                data.artists,
                data.albums,
                data.songs,
                data.artist_map,
                data.album_map,
            ),
            None => (
                StringTable::new(),
                Vec::new(),
                Vec::new(),
                Vec::new(),
                HashMap::new(),
                HashMap::new(),
            ),
        };
    
    let existing_song_count = songs.len() as u32;
    let existing_artist_count = artists.len() as u32;
    let existing_album_count = albums.len() as u32;

    // Find current bucket and file count
    let (mut current_bucket, mut files_in_bucket) = get_current_bucket(&music_path)?;

    let mut files_saved = 0u32;

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
        songs.push(SongEntry::new(
            title_string_id,
            artist_id,
            album_id,
            path_string_id,
            metadata.track_number.unwrap_or(0) as u16,
            metadata.duration_secs.unwrap_or(0) as u16,
        ));

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
        read_file.read_to_end(&mut data)
            .map_err(|e| format!("Failed to read library.bin: {}", e))?;
    }

    let header = LibraryHeader::from_bytes(&data)
        .ok_or("Invalid library.bin header")?;

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

    for song_id in song_ids {
        if song_id >= header.song_count {
            not_found.push(song_id);
            continue;
        }

        // Calculate song entry offset
        let song_offset = header.song_table_offset as usize + (song_id as usize * SongEntry::SIZE as usize);

        // Read the path_string_id (bytes 12-16 of the song entry)
        let path_string_id = u32::from_le_bytes(
            data[song_offset + 12..song_offset + 16].try_into()
                .map_err(|_| format!("Failed to read path_string_id for song {}", song_id))?
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

    Ok(crate::models::DeleteSongsResult {
        songs_deleted,
        not_found,
        files_deleted,
    })
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

    let header = LibraryHeader::from_bytes(&data)
        .ok_or("Invalid library.bin header")?;

    // Parse string table to get the old path
    let strings = parse_string_table(
        &data,
        header.string_table_offset as usize,
        header.artist_table_offset as usize,
    )?;

    // Get the old song entry to preserve its path
    let song_offset = header.song_table_offset as usize + (song_id as usize * SongEntry::SIZE as usize);
    let old_path_string_id = u32::from_le_bytes(
        data[song_offset + 12..song_offset + 16].try_into()
            .map_err(|_| "Failed to read path_string_id")?
    );
    let old_path = strings.get(old_path_string_id as usize)
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
    write_library_bin(
        &library_bin_path,
        &string_table,
        &artists,
        &albums,
        &songs,
    )?;

    Ok(crate::models::EditSongResult {
        new_song_id,
        artist_created: artists.len() > old_artist_count,
        album_created: albums.len() > old_album_count,
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

    let header = LibraryHeader::from_bytes(&data)
        .ok_or("Invalid library.bin header")?;

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

    let deleted_songs = raw_songs.iter().filter(|s| s.flags & song_flags::DELETED != 0).count() as u32;
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

    let header = LibraryHeader::from_bytes(&data)
        .ok_or("Invalid library.bin header")?;

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
    let songs_removed = old_songs.iter().filter(|s| s.flags & song_flags::DELETED != 0).count() as u32;

    // Filter to only active songs
    let active_songs: Vec<_> = old_songs.iter()
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
            let name = old_strings.get(artist.name_string_id as usize)
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
            let name = old_strings.get(album.name_string_id as usize)
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
    for song in active_songs {
        let title = old_strings.get(song.title_string_id as usize)
            .cloned()
            .unwrap_or_default();
        let path = old_strings.get(song.path_string_id as usize)
            .cloned()
            .unwrap_or_default();

        let title_string_id = new_string_table.add(&title);
        let path_string_id = new_string_table.add(&path);
        let new_artist_id = *artist_id_map.get(&song.artist_id).unwrap_or(&0);
        let new_album_id = *album_id_map.get(&song.album_id).unwrap_or(&0);

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

    Ok(crate::models::CompactResult {
        songs_removed,
        artists_removed,
        albums_removed,
        strings_removed,
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

    let mut file = fs::File::create(path)
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
    file.sync_all()
        .map_err(|e| format!("Failed to sync: {}", e))?;

    Ok(())
}

/// Get the current bucket index and file count.
fn get_current_bucket(music_path: &Path) -> Result<(u32, usize), String> {
    if !music_path.exists() {
        return Ok((0, 0));
    }

    let mut max_bucket = 0u32;
    let entries = fs::read_dir(music_path)
        .map_err(|e| format!("Failed to read music directory: {}", e))?;

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
    let header = LibraryHeader::from_bytes(&data)
        .ok_or("Invalid library.bin header")?;

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

    Ok(ParsedLibrary {
        version: header.version,
        artists,
        albums,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_string_deduplication_across_batches() {
        // Create a temp directory
        let temp_dir = tempfile::TempDir::new().unwrap();
        let base_path = temp_dir.path().to_string_lossy().to_string();
        
        // Initialize library
        initialize_library(base_path.clone()).unwrap();
        
        // Create a dummy audio file
        let dummy_file = temp_dir.path().join("test.mp3");
        std::fs::write(&dummy_file, b"fake audio data").unwrap();
        
        // First batch: add one song
        let files1 = vec![FileToSave {
            source_path: dummy_file.to_string_lossy().to_string(),
            metadata: crate::models::AudioMetadata {
                title: Some("Song One".to_string()),
                artist: Some("Test Artist".to_string()),
                album: Some("Test Album".to_string()),
                year: Some(2020),
                track_number: Some(1),
                duration_secs: Some(180),
            },
        }];
        
        let result1 = save_to_library(base_path.clone(), files1).unwrap();
        println!("First batch: {:?}", result1);
        
        // Create another dummy file
        let dummy_file2 = temp_dir.path().join("test2.mp3");
        std::fs::write(&dummy_file2, b"fake audio data 2").unwrap();
        
        // Second batch: add another song with SAME album name
        let files2 = vec![FileToSave {
            source_path: dummy_file2.to_string_lossy().to_string(),
            metadata: crate::models::AudioMetadata {
                title: Some("Song Two".to_string()),
                artist: Some("Test Artist".to_string()),  // Same artist
                album: Some("Test Album".to_string()),    // Same album!
                year: Some(2020),
                track_number: Some(2),
                duration_secs: Some(200),
            },
        }];
        
        let result2 = save_to_library(base_path.clone(), files2).unwrap();
        println!("Second batch: {:?}", result2);
        
        // Load library and check for duplicates
        let library = load_library(base_path.clone()).unwrap();
        
        // Should have 2 songs, 1 artist, 1 album
        assert_eq!(library.songs.len(), 2, "Should have 2 songs");
        assert_eq!(library.artists.len(), 1, "Should have 1 artist (no duplicates)");
        assert_eq!(library.albums.len(), 1, "Should have 1 album (no duplicates)");
        
        // Check result2 reports 0 new artists/albums
        assert_eq!(result2.artists_added, 0, "Second batch should add 0 new artists");
        assert_eq!(result2.albums_added, 0, "Second batch should add 0 new albums");
        
        // Check the string table by reading raw file
        let library_bin_path = temp_dir.path().join("jp3/metadata/library.bin");
        let data = std::fs::read(&library_bin_path).unwrap();
        let header = LibraryHeader::from_bytes(&data).unwrap();
        let strings = parse_string_table(
            &data,
            header.string_table_offset as usize,
            header.artist_table_offset as usize,
        ).unwrap();
        
        println!("Strings in table: {:?}", strings);
        
        // Count occurrences of "Test Album"
        let album_count = strings.iter().filter(|s| *s == "Test Album").count();
        assert_eq!(album_count, 1, "String 'Test Album' should appear exactly once, found {}", album_count);
    }

    #[test]
    fn test_soft_delete_songs() {
        let temp_dir = tempfile::TempDir::new().unwrap();
        let base_path = temp_dir.path().to_string_lossy().to_string();
        
        initialize_library(base_path.clone()).unwrap();
        
        // Add two songs
        let dummy_file1 = temp_dir.path().join("test1.mp3");
        let dummy_file2 = temp_dir.path().join("test2.mp3");
        std::fs::write(&dummy_file1, b"fake audio data 1").unwrap();
        std::fs::write(&dummy_file2, b"fake audio data 2").unwrap();
        
        let files = vec![
            FileToSave {
                source_path: dummy_file1.to_string_lossy().to_string(),
                metadata: crate::models::AudioMetadata {
                    title: Some("Song One".to_string()),
                    artist: Some("Artist".to_string()),
                    album: Some("Album".to_string()),
                    year: Some(2020),
                    track_number: Some(1),
                    duration_secs: Some(180),
                },
            },
            FileToSave {
                source_path: dummy_file2.to_string_lossy().to_string(),
                metadata: crate::models::AudioMetadata {
                    title: Some("Song Two".to_string()),
                    artist: Some("Artist".to_string()),
                    album: Some("Album".to_string()),
                    year: Some(2020),
                    track_number: Some(2),
                    duration_secs: Some(200),
                },
            },
        ];
        
        save_to_library(base_path.clone(), files).unwrap();
        
        // Verify we have 2 songs
        let library = load_library(base_path.clone()).unwrap();
        assert_eq!(library.songs.len(), 2, "Should have 2 songs before delete");
        
        // Verify audio files exist before delete
        let music_path = temp_dir.path().join("jp3/music");
        let audio_file_1 = music_path.join("00/001.mp3");
        let audio_file_2 = music_path.join("00/002.mp3");
        assert!(audio_file_1.exists(), "Audio file 1 should exist before delete");
        assert!(audio_file_2.exists(), "Audio file 2 should exist before delete");
        
        // Delete song 0
        let delete_result = delete_songs(base_path.clone(), vec![0]).unwrap();
        assert_eq!(delete_result.songs_deleted, 1, "Should delete 1 song");
        assert_eq!(delete_result.files_deleted, 1, "Should delete 1 audio file");
        assert!(delete_result.not_found.is_empty(), "Should not have any not_found");
        
        // Verify audio file was deleted
        assert!(!audio_file_1.exists(), "Audio file 1 should be deleted");
        assert!(audio_file_2.exists(), "Audio file 2 should still exist");
        
        // Verify we now have 1 song (deleted one is filtered out)
        let library = load_library(base_path.clone()).unwrap();
        assert_eq!(library.songs.len(), 1, "Should have 1 song after delete");
        assert_eq!(library.songs[0].title, "Song Two", "Remaining song should be Song Two");
        
        // Check stats show 1 deleted
        let stats = get_library_stats(base_path.clone()).unwrap();
        assert_eq!(stats.total_songs, 2, "Total songs should still be 2");
        assert_eq!(stats.active_songs, 1, "Active songs should be 1");
        assert_eq!(stats.deleted_songs, 1, "Deleted songs should be 1");
        
        println!("Delete test passed! Stats: {:?}", stats);
    }

    #[test]
    fn test_delete_nonexistent_song() {
        let temp_dir = tempfile::TempDir::new().unwrap();
        let base_path = temp_dir.path().to_string_lossy().to_string();
        
        initialize_library(base_path.clone()).unwrap();
        
        // Add one song
        let dummy_file = temp_dir.path().join("test.mp3");
        std::fs::write(&dummy_file, b"fake audio data").unwrap();
        
        let files = vec![FileToSave {
            source_path: dummy_file.to_string_lossy().to_string(),
            metadata: crate::models::AudioMetadata {
                title: Some("Song One".to_string()),
                artist: Some("Artist".to_string()),
                album: Some("Album".to_string()),
                year: Some(2020),
                track_number: Some(1),
                duration_secs: Some(180),
            },
        }];
        
        save_to_library(base_path.clone(), files).unwrap();
        
        // Try to delete nonexistent song IDs
        let delete_result = delete_songs(base_path.clone(), vec![5, 10, 100]).unwrap();
        assert_eq!(delete_result.songs_deleted, 0, "Should delete 0 songs");
        assert_eq!(delete_result.not_found.len(), 3, "Should have 3 not_found");
        
        println!("Delete nonexistent test passed!");
    }

    #[test]
    fn test_compact_library() {
        let temp_dir = tempfile::TempDir::new().unwrap();
        let base_path = temp_dir.path().to_string_lossy().to_string();
        
        initialize_library(base_path.clone()).unwrap();
        
        // Add three songs with different artists/albums
        let dummy_file1 = temp_dir.path().join("test1.mp3");
        let dummy_file2 = temp_dir.path().join("test2.mp3");
        let dummy_file3 = temp_dir.path().join("test3.mp3");
        std::fs::write(&dummy_file1, b"fake audio data 1").unwrap();
        std::fs::write(&dummy_file2, b"fake audio data 2").unwrap();
        std::fs::write(&dummy_file3, b"fake audio data 3").unwrap();
        
        let files = vec![
            FileToSave {
                source_path: dummy_file1.to_string_lossy().to_string(),
                metadata: crate::models::AudioMetadata {
                    title: Some("Song One".to_string()),
                    artist: Some("Artist One".to_string()),
                    album: Some("Album One".to_string()),
                    year: Some(2020),
                    track_number: Some(1),
                    duration_secs: Some(180),
                },
            },
            FileToSave {
                source_path: dummy_file2.to_string_lossy().to_string(),
                metadata: crate::models::AudioMetadata {
                    title: Some("Song Two".to_string()),
                    artist: Some("Artist Two".to_string()),
                    album: Some("Album Two".to_string()),
                    year: Some(2021),
                    track_number: Some(1),
                    duration_secs: Some(200),
                },
            },
            FileToSave {
                source_path: dummy_file3.to_string_lossy().to_string(),
                metadata: crate::models::AudioMetadata {
                    title: Some("Song Three".to_string()),
                    artist: Some("Artist One".to_string()), // Same as song 1
                    album: Some("Album One".to_string()),   // Same as song 1
                    year: Some(2020),
                    track_number: Some(2),
                    duration_secs: Some(220),
                },
            },
        ];
        
        save_to_library(base_path.clone(), files).unwrap();
        
        // Verify initial state
        let stats_before = get_library_stats(base_path.clone()).unwrap();
        println!("Before delete: {:?}", stats_before);
        assert_eq!(stats_before.total_artists, 2, "Should have 2 artists");
        assert_eq!(stats_before.total_albums, 2, "Should have 2 albums");
        
        // Delete song 1 (Song Two with Artist Two / Album Two)
        delete_songs(base_path.clone(), vec![1]).unwrap();
        
        // Check stats before compaction
        let stats_deleted = get_library_stats(base_path.clone()).unwrap();
        println!("After delete, before compact: {:?}", stats_deleted);
        assert_eq!(stats_deleted.deleted_songs, 1);
        assert_eq!(stats_deleted.total_artists, 2, "Artists still 2 before compact");
        
        // Compact
        let compact_result = compact_library(base_path.clone()).unwrap();
        println!("Compact result: {:?}", compact_result);
        
        assert_eq!(compact_result.songs_removed, 1, "Should remove 1 song");
        assert_eq!(compact_result.artists_removed, 1, "Should remove orphaned Artist Two");
        assert_eq!(compact_result.albums_removed, 1, "Should remove orphaned Album Two");
        assert!(compact_result.bytes_saved > 0, "Should save some bytes");
        
        // Verify final state
        let stats_after = get_library_stats(base_path.clone()).unwrap();
        println!("After compact: {:?}", stats_after);
        assert_eq!(stats_after.total_songs, 2, "Should have 2 songs");
        assert_eq!(stats_after.deleted_songs, 0, "Should have 0 deleted");
        assert_eq!(stats_after.total_artists, 1, "Should have 1 artist");
        assert_eq!(stats_after.total_albums, 1, "Should have 1 album");
        
        // Verify the remaining songs are correct
        let library = load_library(base_path.clone()).unwrap();
        assert_eq!(library.songs.len(), 2);
        let titles: Vec<_> = library.songs.iter().map(|s| s.title.as_str()).collect();
        assert!(titles.contains(&"Song One"));
        assert!(titles.contains(&"Song Three"));
        assert!(!titles.contains(&"Song Two")); // This was deleted
        
        println!("Compact test passed!");
    }

    #[test]
    fn test_edit_song_metadata() {
        let temp_dir = tempfile::TempDir::new().unwrap();
        let base_path = temp_dir.path().to_string_lossy().to_string();
        
        initialize_library(base_path.clone()).unwrap();
        
        // Add one song
        let dummy_file = temp_dir.path().join("test.mp3");
        std::fs::write(&dummy_file, b"fake audio data").unwrap();
        
        let files = vec![FileToSave {
            source_path: dummy_file.to_string_lossy().to_string(),
            metadata: crate::models::AudioMetadata {
                title: Some("Wrong Title".to_string()),
                artist: Some("Wrong Artist".to_string()),
                album: Some("Wrong Album".to_string()),
                year: Some(2020),
                track_number: Some(1),
                duration_secs: Some(180),
            },
        }];
        
        save_to_library(base_path.clone(), files).unwrap();
        
        // Edit the song
        let new_metadata = crate::models::AudioMetadata {
            title: Some("Correct Title".to_string()),
            artist: Some("Correct Artist".to_string()),
            album: Some("Correct Album".to_string()),
            year: Some(2021),
            track_number: Some(1),
            duration_secs: Some(180),
        };
        
        let edit_result = edit_song_metadata(base_path.clone(), 0, new_metadata).unwrap();
        println!("Edit result: {:?}", edit_result);
        
        assert!(edit_result.artist_created, "Should create new artist");
        assert!(edit_result.album_created, "Should create new album");
        
        // Verify the library now shows the corrected metadata
        let library = load_library(base_path.clone()).unwrap();
        assert_eq!(library.songs.len(), 1, "Should have 1 active song");
        assert_eq!(library.songs[0].title, "Correct Title");
        assert_eq!(library.songs[0].artist_name, "Correct Artist");
        assert_eq!(library.songs[0].album_name, "Correct Album");
        
        // Stats should show the old one as deleted
        let stats = get_library_stats(base_path.clone()).unwrap();
        assert_eq!(stats.total_songs, 2, "Total songs should be 2 (old + new)");
        assert_eq!(stats.active_songs, 1, "Active songs should be 1");
        assert_eq!(stats.deleted_songs, 1, "Deleted songs should be 1");
        
        println!("Edit test passed!");
    }
}
