//! Tauri command handlers.
//!
//! Commands are organized by domain:
//! - `config`: Application configuration (library path storage)
//! - `library`: Library initialization and management
//! - `audio`: Audio file processing and metadata extraction
//! - `playlist`: Playlist management
//! - `cover_art`: Album cover art fetching and caching

pub mod audio;
pub mod config;
pub mod cover_art;
pub mod library;
pub mod playlist;

pub use audio::*;
pub use config::*;
pub use cover_art::*;
pub use library::*;
pub use playlist::*;
