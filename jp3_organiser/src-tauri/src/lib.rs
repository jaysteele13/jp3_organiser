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
//! - `models/` - Data structures
//!   - `audio` - TrackedAudioFile, MetadataStatus, AudioMetadata
//!   - `library` - LibraryHeader, LibraryInfo

mod commands;
mod models;
mod services;

use commands::{
    // Audio commands
    get_audio_metadata,
    process_audio_files,
    // Config commands
    clear_library_path,
    get_library_path,
    set_library_path,
    // Library commands
    compact_library,
    delete_songs,
    edit_song_metadata,
    get_library_info,
    get_library_stats,
    initialize_library,
    load_library,
    save_to_library,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|_app| {
            dotenvy::from_filename(".env.local").ok();
            env_logger::init();
            log::info!("JP3 Organiser starting...");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Audio commands
            process_audio_files,
            get_audio_metadata,
            // Config commands
            get_library_path,
            set_library_path,
            clear_library_path,
            // Library commands
            initialize_library,
            get_library_info,
            save_to_library,
            load_library,
            delete_songs,
            edit_song_metadata,
            get_library_stats,
            compact_library,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
