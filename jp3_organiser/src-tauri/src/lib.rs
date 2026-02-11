//! JP3 Organiser - Tauri Backend
//!
//! This is the main entry point for the Tauri application.
//! It wires together all modules and registers commands.
//!
//! # Module Structure
//!
//! - `commands/` - Tauri command handlers
//!   - `audio` - Audio file processing and metadata extraction
//!   - `config` - Library path persistence
//!   - `library` - Library initialization and info
//!   - `playlist` - Playlist management
//! - `models/` - Data structures
//!   - `audio` - TrackedAudioFile, MetadataStatus, AudioMetadata
//!   - `library` - LibraryHeader, LibraryInfo
//!   - `playlist` - PlaylistHeader, ParsedPlaylist
//! - `services/` - Business logic services
//!   - `fingerprint_service` - Audio fingerprinting with fpcalc
//!   - `metadata_ranking_service` - AcoustID response ranking
use tauri::{AppHandle, Manager};
use dotenv::dotenv;
use std::env;

pub mod commands;
pub mod models;
pub mod services;

// Splash Function
#[tauri::command]
fn splash_screen(app: AppHandle) -> Result<(), String> {
    if let Some(splash) = app.get_webview_window("splash_screen") {
        let _ = splash.close();
    }
    else {
        println!("Splash Screen Window not found");
    }

    // show main
    if let Some(main) = app.get_webview_window("main") {
        main.maximize().map_err(|e| e.to_string())?;
        main.set_decorations(true).map_err(|e| e.to_string())?;
        main.show().map_err(|e | e.to_string())?;
    } else {
        return Err("main window not found".into());
    }
    Ok(())
}


use commands::{
    // Audio commands
    get_audio_metadata,
    process_audio_files,
    process_single_audio_file,
    // Config commands
    clear_library_path,
    get_library_path,
    set_library_path,
    // Cover art commands
    clear_cover_cache,
    fetch_album_cover,
    fetch_artist_cover,
    fetch_deezer_album_cover,
    get_album_cover_path,
    read_album_cover,
    read_artist_cover,
    search_album_mbid,
    search_album_mbids_batch,
    // Library commands
    compact_library,
    delete_album,
    delete_artist,
    delete_songs,
    edit_album,
    edit_artist,
    edit_song_metadata,
    get_library_info,
    get_library_stats,
    initialize_library,
    load_library,
    save_to_library,
    // Playlist commands
    add_songs_to_playlist,
    create_playlist,
    delete_playlist_by_name,
    list_playlists,
    load_playlist,
    remove_songs_from_playlist,
    rename_playlist,
    save_to_playlist,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv().ok();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Audio commands
            process_audio_files,
            process_single_audio_file,
            get_audio_metadata,
            // Config commands
            get_library_path,
            set_library_path,
            clear_library_path,
            // Cover art commands
            clear_cover_cache,
            fetch_album_cover,
            fetch_artist_cover,
            fetch_deezer_album_cover,
            get_album_cover_path,
            read_album_cover,
            read_artist_cover,
            search_album_mbid,
            search_album_mbids_batch,
            // Library commands
            initialize_library,
            get_library_info,
            save_to_library,
            load_library,
            delete_songs,
            delete_album,
            delete_artist,
            edit_song_metadata,
            edit_album,
            edit_artist,
            get_library_stats,
            compact_library,
            // Playlist commands
            create_playlist,
            load_playlist,
            list_playlists,
            delete_playlist_by_name,
            rename_playlist,
            save_to_playlist,
            add_songs_to_playlist,
            remove_songs_from_playlist,
            splash_screen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
