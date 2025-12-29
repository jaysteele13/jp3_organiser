//! Tauri command handlers.
//!
//! Commands are organized by domain:
//! - `config`: Application configuration (library path storage)
//! - `library`: Library initialization and management
//! - `audio`: Audio file processing and metadata extraction

pub mod audio;
pub mod config;
pub mod library;

pub use audio::*;
pub use config::*;
pub use library::*;
