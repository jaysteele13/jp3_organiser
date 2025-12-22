//! Tauri command handlers.
//!
//! Commands are organized by domain:
//! - `config`: Application configuration (library path storage)
//! - `library`: Library initialization and management

mod config;
mod library;

pub use config::*;
pub use library::*;
