use tauri_plugin_store::StoreExt;
use std::path::Path;

const STORE_FILENAME: &str = "config.json";
const LIBRARY_PATH_KEY: &str = "library_path";

/// Get the saved library path from persistent storage
#[tauri::command]
fn get_library_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let path = store
        .get(LIBRARY_PATH_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string()));

    Ok(path)
}

/// Save the library path to persistent storage
/// Validates that the path exists and is a directory
#[tauri::command]
fn set_library_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    // Validate the path exists and is a directory
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

/// Clear the library path from persistent storage
#[tauri::command]
fn clear_library_path(app: tauri::AppHandle) -> Result<(), String> {
    let store = app
        .store(STORE_FILENAME)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    store.delete(LIBRARY_PATH_KEY);
    store.save().map_err(|e| format!("Failed to save store: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_upload::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_library_path,
            set_library_path,
            clear_library_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
