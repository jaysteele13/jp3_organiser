use tauri_plugin_store::StoreExt;
use std::path::Path;
use std::fs;
use std::io::Write;

const STORE_FILENAME: &str = "config.json";
const LIBRARY_PATH_KEY: &str = "library_path";

// JP3 directory structure constants
const JP3_DIR: &str = "jp3";
const MUSIC_DIR: &str = "music";
const METADATA_DIR: &str = "metadata";
const PLAYLISTS_DIR: &str = "playlists";
const LIBRARY_BIN: &str = "library.bin";

// Library binary format constants
const LIBRARY_MAGIC: &[u8; 4] = b"LIB1";
const LIBRARY_VERSION: u32 = 1;

/// Library header structure for binary serialization
/// 
/// Binary layout (40 bytes total):
/// - magic: 4 bytes ("LIB1")
/// - version: 4 bytes (u32)
/// - song_count: 4 bytes (u32)
/// - artist_count: 4 bytes (u32)
/// - album_count: 4 bytes (u32)
/// - string_table_offset: 4 bytes (u32)
/// - artist_table_offset: 4 bytes (u32)
/// - album_table_offset: 4 bytes (u32)
/// - song_table_offset: 4 bytes (u32)
/// - reserved: 4 bytes (for future use)
#[derive(Debug)]
struct LibraryHeader {
    magic: [u8; 4],
    version: u32,
    song_count: u32,
    artist_count: u32,
    album_count: u32,
    string_table_offset: u32,
    artist_table_offset: u32,
    album_table_offset: u32,
    song_table_offset: u32,
}

impl LibraryHeader {
    /// Create a new empty library header
    fn new_empty() -> Self {
        // For an empty library, all tables start right after the header (40 bytes)
        let header_size: u32 = 40;
        Self {
            magic: *LIBRARY_MAGIC,
            version: LIBRARY_VERSION,
            song_count: 0,
            artist_count: 0,
            album_count: 0,
            string_table_offset: header_size,
            artist_table_offset: header_size,
            album_table_offset: header_size,
            song_table_offset: header_size,
        }
    }

    /// Serialize header to bytes (little-endian)
    fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(40);
        bytes.extend_from_slice(&self.magic);
        bytes.extend_from_slice(&self.version.to_le_bytes());
        bytes.extend_from_slice(&self.song_count.to_le_bytes());
        bytes.extend_from_slice(&self.artist_count.to_le_bytes());
        bytes.extend_from_slice(&self.album_count.to_le_bytes());
        bytes.extend_from_slice(&self.string_table_offset.to_le_bytes());
        bytes.extend_from_slice(&self.artist_table_offset.to_le_bytes());
        bytes.extend_from_slice(&self.album_table_offset.to_le_bytes());
        bytes.extend_from_slice(&self.song_table_offset.to_le_bytes());
        // Reserved 4 bytes
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes
    }
}

/// Initialize the JP3 library directory structure
/// Creates: jp3/music/, jp3/metadata/, jp3/playlists/
/// Also creates an initial music bucket (00/) and empty library.bin
#[tauri::command]
fn initialize_library(base_path: String) -> Result<String, String> {
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

    // Create main jp3 directory
    fs::create_dir_all(&jp3_path)
        .map_err(|e| format!("Failed to create jp3 directory: {}", e))?;

    // Create subdirectories
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

/// Get information about the current library structure
#[tauri::command]
fn get_library_info(base_path: String) -> Result<LibraryInfo, String> {
    let base = Path::new(&base_path);
    let jp3_path = base.join(JP3_DIR);
    
    if !jp3_path.exists() {
        return Ok(LibraryInfo {
            initialized: false,
            jp3_path: None,
            music_buckets: 0,
            has_library_bin: false,
        });
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

#[derive(serde::Serialize)]
struct LibraryInfo {
    initialized: bool,
    jp3_path: Option<String>,
    music_buckets: u32,
    has_library_bin: bool,
}

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
            clear_library_path,
            initialize_library,
            get_library_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
