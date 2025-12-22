//! Library management commands.
//!
//! Handles library initialization, status queries, and saving files to library.

use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::Path;

use crate::models::{
    AlbumEntry, ArtistEntry, AudioMetadata, LibraryHeader, LibraryInfo, SaveToLibraryResult,
    SongEntry, StringTable, HEADER_SIZE,
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

/// Save audio files to the library.
///
/// This command:
/// 1. Copies audio files to the appropriate music bucket
/// 2. Builds the library.bin with deduped artists, albums, and songs
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

    // Build lookup tables
    let mut string_table = StringTable::new();
    let mut artists: Vec<ArtistEntry> = Vec::new();
    let mut albums: Vec<AlbumEntry> = Vec::new();
    let mut songs: Vec<SongEntry> = Vec::new();

    // Maps for deduplication: name -> id
    let mut artist_map: HashMap<String, u32> = HashMap::new();
    // Album key: "artist_id:album_name" -> album_id
    let mut album_map: HashMap<String, u32> = HashMap::new();

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

        // Sanitize filename and copy
        let original_name = source
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown.mp3");
        let sanitized_name = sanitize_filename(original_name);
        let relative_path = format!("{:02}/{}", current_bucket, sanitized_name);
        let dest_path = music_path.join(&relative_path);

        // Copy file
        fs::copy(source, &dest_path)
            .map_err(|e| format!("Failed to copy {}: {}", original_name, e))?;

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
        artists_added: artists.len() as u32,
        albums_added: albums.len() as u32,
        songs_added: songs.len() as u32,
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

/// Sanitize a filename for safe storage.
/// Removes/replaces illegal characters and trims whitespace.
fn sanitize_filename(name: &str) -> String {
    let illegal_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    let mut result: String = name
        .chars()
        .map(|c| if illegal_chars.contains(&c) { '_' } else { c })
        .collect();

    // Trim whitespace
    result = result.trim().to_string();

    // Ensure non-empty
    if result.is_empty() {
        result = "unnamed.mp3".to_string();
    }

    result
}
