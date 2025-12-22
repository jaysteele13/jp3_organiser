//! Configuration commands for persistent storage.
//!
//! Handles saving/loading the library path using tauri-plugin-store.

use std::path::Path;
use tauri_plugin_store::StoreExt;

const STORE_FILENAME: &str = "config.json";
const LIBRARY_PATH_KEY: &str = "library_path";

/// Get the saved library path from persistent storage.
#[tauri::command]
pub fn get_library_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let path = store
        .get(LIBRARY_PATH_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    Ok(path)
}

/// Save the library path to persistent storage.
///
/// Validates that the path exists and is a directory.
#[tauri::command]
pub fn set_library_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let path_ref = Path::new(&path);
    
    if !path_ref.exists() {
        return Err("Path does not exist".to_string());
    }
    if !path_ref.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.set(LIBRARY_PATH_KEY, serde_json::json!(path));
    store.save().map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

/// Clear the library path from persistent storage.
#[tauri::command]
pub fn clear_library_path(app: tauri::AppHandle) -> Result<(), String> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.delete(LIBRARY_PATH_KEY);
    store.save().map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}
