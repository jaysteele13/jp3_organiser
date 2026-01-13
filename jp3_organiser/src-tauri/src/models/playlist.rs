//! Playlist data structures for JP3 binary format.
//!
//! Each playlist is stored as a separate binary file in jp3/playlists/{id}.bin
//! This minimizes SD card writes when playlists are modified.
//!
//! Binary format (per playlist file):
//! - Header: magic (4 bytes) + version (4 bytes) + song_count (4 bytes) + name_length (2 bytes)
//! - Name: UTF-8 string (name_length bytes)
//! - Song IDs: array of u32 song IDs (song_count * 4 bytes)

use serde::{Deserialize, Serialize};

// Binary format constants
pub const PLAYLIST_MAGIC: &[u8; 4] = b"PLY1";
pub const PLAYLIST_VERSION: u32 = 1;
pub const PLAYLIST_HEADER_SIZE: usize = 14; // 4 + 4 + 4 + 2

/// Playlist header structure for binary serialization.
///
/// Binary layout (14 bytes):
/// ```text
/// Offset  Size  Field
/// 0x00    4     magic ("PLY1")
/// 0x04    4     version
/// 0x08    4     song_count
/// 0x0C    2     name_length
/// ```
#[derive(Debug, Clone)]
pub struct PlaylistHeader {
    pub magic: [u8; 4],
    pub version: u32,
    pub song_count: u32,
    pub name_length: u16,
}

impl PlaylistHeader {
    /// Create a new playlist header.
    pub fn new(song_count: u32, name_length: u16) -> Self {
        Self {
            magic: *PLAYLIST_MAGIC,
            version: PLAYLIST_VERSION,
            song_count,
            name_length,
        }
    }

    /// Serialize header to bytes (little-endian).
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(PLAYLIST_HEADER_SIZE);
        bytes.extend_from_slice(&self.magic);
        bytes.extend_from_slice(&self.version.to_le_bytes());
        bytes.extend_from_slice(&self.song_count.to_le_bytes());
        bytes.extend_from_slice(&self.name_length.to_le_bytes());
        bytes
    }

    /// Parse header from bytes.
    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < PLAYLIST_HEADER_SIZE {
            return None;
        }

        let magic: [u8; 4] = bytes[0..4].try_into().ok()?;
        if &magic != PLAYLIST_MAGIC {
            return None;
        }

        Some(Self {
            magic,
            version: u32::from_le_bytes(bytes[4..8].try_into().ok()?),
            song_count: u32::from_le_bytes(bytes[8..12].try_into().ok()?),
            name_length: u16::from_le_bytes(bytes[12..14].try_into().ok()?),
        })
    }
}

/// Parsed playlist data for frontend display.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedPlaylist {
    /// Playlist ID (derived from filename)
    pub id: u32,
    /// Playlist name
    pub name: String,
    /// Number of songs in the playlist
    pub song_count: u32,
    /// List of song IDs in playlist order
    pub song_ids: Vec<u32>,
}

/// Input for creating a playlist with songs.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlaylistInput {
    /// Playlist name
    pub name: String,
    /// Song IDs to add to the playlist
    pub song_ids: Vec<u32>,
}

/// Result returned after creating a playlist.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePlaylistResult {
    /// The ID of the newly created playlist
    pub playlist_id: u32,
    /// Number of songs added
    pub songs_added: u32,
}

/// Result returned after saving songs and creating a playlist in one operation.
/// This is used by the "Add Playlist" upload mode.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveToPlaylistResult {
    /// Number of files saved to library
    pub files_saved: u32,
    /// Number of new artists created
    pub artists_added: u32,
    /// Number of new albums created
    pub albums_added: u32,
    /// Number of new songs added to library
    pub songs_added: u32,
    /// Number of duplicate songs skipped
    pub duplicates_skipped: u32,
    /// The ID of the created playlist
    pub playlist_id: u32,
    /// Name of the created playlist
    pub playlist_name: String,
    /// Album IDs for each saved song (for MBID mapping)
    pub album_ids: Vec<u32>,
}

/// Result returned after deleting a playlist.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePlaylistResult {
    /// Whether the playlist was successfully deleted
    pub deleted: bool,
}

/// Summary of all playlists for the View page.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistSummary {
    /// Playlist ID
    pub id: u32,
    /// Playlist name
    pub name: String,
    /// Number of songs
    pub song_count: u32,
}
