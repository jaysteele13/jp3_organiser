//! Library management commands.
//!
//! Handles library initialization, status queries, and saving files to library.

use std::collections::HashMap;
use std::fs;
use std::io::{Read, Write};
use std::path::Path;

use crate::models::{
    AlbumEntry, ArtistEntry, AudioMetadata, LibraryHeader, LibraryInfo, ParsedAlbum,
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
        songs.push(SongEntry {
            title_string_id,
            artist_id,
            album_id,
            path_string_id,
            track_number: metadata.track_number.unwrap_or(0) as u16,
            duration_sec: metadata.duration_secs.unwrap_or(0) as u16,
        });

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

    // Build parsed songs with resolved names
    let songs: Vec<ParsedSong> = raw_songs
        .iter()
        .enumerate()
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
}

/// Parse song table from binary data.
fn parse_song_table(data: &[u8], start: usize, count: usize) -> Result<Vec<RawSong>, String> {
    let mut songs = Vec::with_capacity(count);
    let entry_size = SongEntry::SIZE as usize;

    for i in 0..count {
        let offset = start + i * entry_size;
        if offset + 20 > data.len() {
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
        songs.push(RawSong {
            title_string_id,
            artist_id,
            album_id,
            path_string_id,
            track_number,
            duration_sec,
        });
    }

    Ok(songs)
}
