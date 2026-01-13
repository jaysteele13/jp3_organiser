//! Playlist management commands.
//!
//! Handles playlist creation, loading, listing, and deletion.
//! Each playlist is stored as a separate binary file in jp3/playlists/{id}.bin.

use std::collections::{HashMap, HashSet};
use std::fs::{self};
use std::io::{Read, Write};
use std::path::Path;

use crate::models::{
    AudioMetadata, CreatePlaylistResult, DeletePlaylistResult, ParsedPlaylist, PlaylistHeader,
    PlaylistSummary, SaveToPlaylistResult, PLAYLIST_HEADER_SIZE,
};

// Directory constants
const JP3_DIR: &str = "jp3";
const PLAYLISTS_DIR: &str = "playlists";

/// Get the playlists directory path.
fn get_playlists_path(base_path: &Path) -> std::path::PathBuf {
    base_path.join(JP3_DIR).join(PLAYLISTS_DIR)
}

/// Extract playlist ID from a directory entry filename (e.g., "123.bin" -> Some(123)).
fn parse_playlist_id(entry: &fs::DirEntry) -> Option<u32> {
    entry
        .file_name()
        .to_str()?
        .strip_suffix(".bin")?
        .parse()
        .ok()
}

/// Get the next available playlist ID by scanning existing playlist files.
fn get_next_playlist_id(playlists_path: &Path) -> Result<u32, String> {
    if !playlists_path.exists() {
        return Ok(1);
    }

    let entries = fs::read_dir(playlists_path)
        .map_err(|e| format!("Failed to read playlists directory: {}", e))?;

    let max_id = entries
        .flatten()
        .filter_map(|entry| parse_playlist_id(&entry))
        .max()
        .unwrap_or(0);

    Ok(max_id + 1)
}

/// Create a new playlist with the given songs.
///
/// The songs must already exist in library.bin.
#[tauri::command]
pub fn create_playlist(
    base_path: String,
    name: String,
    song_ids: Vec<u32>,
) -> Result<CreatePlaylistResult, String> {
    let base = Path::new(&base_path);
    let playlists_path = get_playlists_path(base);

    // Ensure playlists directory exists
    fs::create_dir_all(&playlists_path)
        .map_err(|e| format!("Failed to create playlists directory: {}", e))?;

    // Get next playlist ID
    let playlist_id = get_next_playlist_id(&playlists_path)?;

    // Write playlist file
    let playlist_file_path = playlists_path.join(format!("{}.bin", playlist_id));
    write_playlist_file(&playlist_file_path, &name, &song_ids)?;

    Ok(CreatePlaylistResult {
        playlist_id,
        songs_added: song_ids.len() as u32,
    })
}

/// Write a playlist binary file.
pub fn write_playlist_file(path: &Path, name: &str, song_ids: &[u32]) -> Result<(), String> {
    let name_bytes = name.as_bytes();
    let header = PlaylistHeader::new(song_ids.len() as u32, name_bytes.len() as u16);

    let mut file =
        fs::File::create(path).map_err(|e| format!("Failed to create playlist file: {}", e))?;

    // Write header
    file.write_all(&header.to_bytes())
        .map_err(|e| format!("Failed to write playlist header: {}", e))?;

    // Write name
    file.write_all(name_bytes)
        .map_err(|e| format!("Failed to write playlist name: {}", e))?;

    // Write song IDs
    for song_id in song_ids {
        file.write_all(&song_id.to_le_bytes())
            .map_err(|e| format!("Failed to write song ID: {}", e))?;
    }

    file.sync_all()
        .map_err(|e| format!("Failed to sync playlist file: {}", e))?;

    Ok(())
}

/// Load a single playlist by ID.
#[tauri::command]
pub fn load_playlist(base_path: String, playlist_id: u32) -> Result<ParsedPlaylist, String> {
    let base = Path::new(&base_path);
    let playlists_path = get_playlists_path(base);
    let playlist_file_path = playlists_path.join(format!("{}.bin", playlist_id));

    if !playlist_file_path.exists() {
        return Err(format!("Playlist {} not found", playlist_id));
    }

    read_playlist_file(&playlist_file_path, playlist_id)
}

/// Read and parse a playlist binary file.
pub fn read_playlist_file(path: &Path, playlist_id: u32) -> Result<ParsedPlaylist, String> {
    let mut file =
        fs::File::open(path).map_err(|e| format!("Failed to open playlist file: {}", e))?;
    let mut data = Vec::new();
    file.read_to_end(&mut data)
        .map_err(|e| format!("Failed to read playlist file: {}", e))?;

    // Parse header
    let header = PlaylistHeader::from_bytes(&data).ok_or("Invalid playlist file header")?;

    // Parse name
    let name_start = PLAYLIST_HEADER_SIZE;
    let name_end = name_start + header.name_length as usize;
    if name_end > data.len() {
        return Err("Playlist file truncated (name)".to_string());
    }
    let name = String::from_utf8(data[name_start..name_end].to_vec())
        .map_err(|_| "Invalid UTF-8 in playlist name")?;

    // Parse song IDs
    let songs_start = name_end;
    let mut song_ids = Vec::with_capacity(header.song_count as usize);
    for i in 0..header.song_count as usize {
        let offset = songs_start + i * 4;
        if offset + 4 > data.len() {
            return Err("Playlist file truncated (song IDs)".to_string());
        }
        let song_id = u32::from_le_bytes(
            data[offset..offset + 4]
                .try_into()
                .map_err(|_| "Failed to read song ID")?,
        );
        song_ids.push(song_id);
    }

    Ok(ParsedPlaylist {
        id: playlist_id,
        name,
        song_count: header.song_count,
        song_ids,
    })
}

/// List all playlists (summaries only, not full song lists).
#[tauri::command]
pub fn list_playlists(base_path: String) -> Result<Vec<PlaylistSummary>, String> {
    let base = Path::new(&base_path);
    let playlists_path = get_playlists_path(base);

    if !playlists_path.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&playlists_path)
        .map_err(|e| format!("Failed to read playlists directory: {}", e))?;

    let mut playlists: Vec<PlaylistSummary> = entries
        .flatten()
        .filter_map(|entry| {
            let playlist_id = parse_playlist_id(&entry)?;
            let playlist = read_playlist_file(&entry.path(), playlist_id).ok()?;
            Some(PlaylistSummary {
                id: playlist.id,
                name: playlist.name,
                song_count: playlist.song_count,
            })
        })
        .collect();

    // Sort by name for easier lookup
    playlists.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(playlists)
}

/// Delete a playlist by name.
///
/// Searches through all playlist files to find one matching the given name,
/// then deletes the corresponding .bin file.
#[tauri::command]
pub fn delete_playlist_by_name(
    base_path: String,
    playlist_name: String,
) -> Result<DeletePlaylistResult, String> {
    let base = Path::new(&base_path);
    let playlists_path = get_playlists_path(base);

    if !playlists_path.exists() {
        return Ok(DeletePlaylistResult { deleted: false });
    }

    let entries = fs::read_dir(&playlists_path)
        .map_err(|e| format!("Failed to read playlists directory: {}", e))?;

    // Find and delete the playlist with matching name
    for entry in entries.flatten() {
        let Some(playlist_id) = parse_playlist_id(&entry) else {
            continue;
        };
        let Ok(playlist) = read_playlist_file(&entry.path(), playlist_id) else {
            continue;
        };
        if playlist.name == playlist_name {
            fs::remove_file(&entry.path())
                .map_err(|e| format!("Failed to delete playlist file: {}", e))?;
            return Ok(DeletePlaylistResult { deleted: true });
        }
    }

    Ok(DeletePlaylistResult { deleted: false })
}

/// Input for saving files to library and creating a playlist.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileToSaveWithPlaylist {
    pub source_path: String,
    pub metadata: AudioMetadata,
}

/// Save audio files to the library AND create a playlist with them.
///
/// This is the combined operation for "Add Playlist" mode:
/// 1. First saves all songs to library.bin (using existing save_to_library logic)
/// 2. Then creates a playlist with the song IDs
///
/// Songs that already exist in the library are detected and their IDs are reused.
#[tauri::command]
pub fn save_to_playlist(
    base_path: String,
    playlist_name: String,
    files: Vec<FileToSaveWithPlaylist>,
) -> Result<SaveToPlaylistResult, String> {
    // Convert to FileToSave format for the existing save_to_library function
    let files_to_save: Vec<crate::commands::library::FileToSave> = files
        .into_iter()
        .map(|f| crate::commands::library::FileToSave {
            source_path: f.source_path,
            metadata: f.metadata,
        })
        .collect();

    // First, save all songs to the library
    let save_result = crate::commands::save_to_library(base_path.clone(), files_to_save.clone())?;

    // Now we need to get the song IDs for the playlist
    // Load the library to find the song IDs
    let library = crate::commands::load_library(base_path.clone())?;

    // Build a lookup map: (title, artist_name, album_name) -> song_id
    let mut song_lookup: HashMap<(String, String, String), u32> = HashMap::new();
    for song in &library.songs {
        let key = (
            song.title.to_lowercase(),
            song.artist_name.to_lowercase(),
            song.album_name.to_lowercase(),
        );
        song_lookup.insert(key, song.id);
    }

    // Find the song IDs for the files we just saved
    let mut playlist_song_ids = Vec::new();
    for file in &files_to_save {
        let metadata = &file.metadata;
        if let (Some(title), Some(artist), Some(album)) = (
            metadata.title.as_ref(),
            metadata.artist.as_ref(),
            metadata.album.as_ref(),
        ) {
            let key = (
                title.to_lowercase(),
                artist.to_lowercase(),
                album.to_lowercase(),
            );
            if let Some(&song_id) = song_lookup.get(&key) {
                playlist_song_ids.push(song_id);
            }
        }
    }

    // Create the playlist
    let playlist_result = create_playlist(base_path, playlist_name.clone(), playlist_song_ids)?;

    Ok(SaveToPlaylistResult {
        files_saved: save_result.files_saved,
        artists_added: save_result.artists_added,
        albums_added: save_result.albums_added,
        songs_added: save_result.songs_added,
        duplicates_skipped: save_result.duplicates_skipped,
        playlist_id: playlist_result.playlist_id,
        playlist_name,
        album_ids: save_result.album_ids,
    })
}

/// Add songs to an existing playlist.
#[tauri::command]
pub fn add_songs_to_playlist(
    base_path: String,
    playlist_id: u32,
    song_ids: Vec<u32>,
) -> Result<CreatePlaylistResult, String> {
    // Load existing playlist
    let mut playlist = load_playlist(base_path.clone(), playlist_id)?;

    // Add new song IDs (avoiding duplicates)
    let existing_ids: HashSet<u32> = playlist.song_ids.iter().cloned().collect();
    let mut new_songs_added = 0u32;
    for song_id in song_ids {
        if !existing_ids.contains(&song_id) {
            playlist.song_ids.push(song_id);
            new_songs_added += 1;
        }
    }

    // Write updated playlist
    let base = Path::new(&base_path);
    let playlists_path = get_playlists_path(base);
    let playlist_file_path = playlists_path.join(format!("{}.bin", playlist_id));
    write_playlist_file(&playlist_file_path, &playlist.name, &playlist.song_ids)?;

    Ok(CreatePlaylistResult {
        playlist_id,
        songs_added: new_songs_added,
    })
}

/// Remove songs from an existing playlist.
#[tauri::command]
pub fn remove_songs_from_playlist(
    base_path: String,
    playlist_id: u32,
    song_ids: Vec<u32>,
) -> Result<CreatePlaylistResult, String> {
    // Load existing playlist
    let mut playlist = load_playlist(base_path.clone(), playlist_id)?;

    // Remove specified song IDs
    let remove_set: HashSet<u32> = song_ids.iter().cloned().collect();
    let original_count = playlist.song_ids.len();
    playlist.song_ids.retain(|id| !remove_set.contains(id));
    let songs_removed = original_count - playlist.song_ids.len();

    // Write updated playlist
    let base = Path::new(&base_path);
    let playlists_path = get_playlists_path(base);
    let playlist_file_path = playlists_path.join(format!("{}.bin", playlist_id));
    write_playlist_file(&playlist_file_path, &playlist.name, &playlist.song_ids)?;

    Ok(CreatePlaylistResult {
        playlist_id,
        songs_added: songs_removed as u32, // Reusing field as "songs_affected"
    })
}

/// Result of renaming a playlist.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RenamePlaylistResult {
    pub success: bool,
    pub old_name: String,
    pub new_name: String,
}

/// Rename a playlist by ID.
#[tauri::command]
pub fn rename_playlist(
    base_path: String,
    playlist_id: u32,
    new_name: String,
) -> Result<RenamePlaylistResult, String> {
    // Validate new name
    let new_name = new_name.trim().to_string();
    if new_name.is_empty() {
        return Err("Playlist name cannot be empty".to_string());
    }

    // Load existing playlist
    let playlist = load_playlist(base_path.clone(), playlist_id)?;
    let old_name = playlist.name.clone();

    // Check for duplicate name (case-insensitive)
    let base = Path::new(&base_path);
    let playlists_path = get_playlists_path(base);

    if playlists_path.exists() {
        let entries = fs::read_dir(&playlists_path)
            .map_err(|e| format!("Failed to read playlists directory: {}", e))?;

        for entry in entries.flatten() {
            let Some(other_id) = parse_playlist_id(&entry) else {
                continue;
            };
            // Skip the current playlist
            if other_id == playlist_id {
                continue;
            }
            let Ok(other_playlist) = read_playlist_file(&entry.path(), other_id) else {
                continue;
            };
            if other_playlist.name.to_lowercase() == new_name.to_lowercase() {
                return Err("A playlist with this name already exists".to_string());
            }
        }
    }

    // Write updated playlist with new name
    let playlist_file_path = playlists_path.join(format!("{}.bin", playlist_id));
    write_playlist_file(&playlist_file_path, &new_name, &playlist.song_ids)?;

    Ok(RenamePlaylistResult {
        success: true,
        old_name,
        new_name,
    })
}
