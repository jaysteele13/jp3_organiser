//! JP3 Organiser - Tauri Backend
//!
//! This is the main entry point for the Tauri application.
//! It wires together all modules and registers commands.
//!
//! # Module Structure
//!
//! - `commands/` - Tauri command handlers
//!   - `config` - Library path persistence
//!   - `library` - Library initialization and info
//! - `models/` - Data structures
//!   - `library` - LibraryHeader, LibraryInfo

mod commands;
mod models;

use commands::{
    clear_library_path, get_library_info, get_library_path, initialize_library, set_library_path,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // Config commands
            get_library_path,
            set_library_path,
            clear_library_path,
            // Library commands
            initialize_library,
            get_library_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
