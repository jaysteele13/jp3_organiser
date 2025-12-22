//! Library management commands.
//!
//! Handles library initialization and status queries.

use std::fs;
use std::io::Write;
use std::path::Path;

use crate::models::{LibraryHeader, LibraryInfo};

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
