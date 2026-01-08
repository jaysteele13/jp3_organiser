//! Library data structures for JP3 binary format.
//!
//! The library.bin format is designed for efficient reading on ESP32:
//! - Fixed-size header for quick parsing
//! - String table for deduplication
//! - Separate tables for artists, albums, and songs
//! - All integers are little-endian

use serde::Serialize;

// Binary format constants
pub const LIBRARY_MAGIC: &[u8; 4] = b"LIB1";
pub const LIBRARY_VERSION: u32 = 1;
pub const HEADER_SIZE: u32 = 40;

/// Library header structure for binary serialization.
///
/// Binary layout (40 bytes total):
/// ```text
/// Offset  Size  Field
/// 0x00    4     magic ("LIB1")
/// 0x04    4     version
/// 0x08    4     song_count
/// 0x0C    4     artist_count
/// 0x10    4     album_count
/// 0x14    4     string_table_offset
/// 0x18    4     artist_table_offset
/// 0x1C    4     album_table_offset
/// 0x20    4     song_table_offset
/// 0x24    4     reserved
/// ```
#[derive(Debug, Clone)]
pub struct LibraryHeader {
    pub magic: [u8; 4],
    pub version: u32,
    pub song_count: u32,
    pub artist_count: u32,
    pub album_count: u32,
    pub string_table_offset: u32,
    pub artist_table_offset: u32,
    pub album_table_offset: u32,
    pub song_table_offset: u32,
}

impl LibraryHeader {
    /// Create a new empty library header.
    pub fn new_empty() -> Self {
        Self {
            magic: *LIBRARY_MAGIC,
            version: LIBRARY_VERSION,
            song_count: 0,
            artist_count: 0,
            album_count: 0,
            string_table_offset: HEADER_SIZE,
            artist_table_offset: HEADER_SIZE,
            album_table_offset: HEADER_SIZE,
            song_table_offset: HEADER_SIZE,
        }
    }

    /// Serialize header to bytes (little-endian).
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(HEADER_SIZE as usize);
        bytes.extend_from_slice(&self.magic);
        bytes.extend_from_slice(&self.version.to_le_bytes());
        bytes.extend_from_slice(&self.song_count.to_le_bytes());
        bytes.extend_from_slice(&self.artist_count.to_le_bytes());
        bytes.extend_from_slice(&self.album_count.to_le_bytes());
        bytes.extend_from_slice(&self.string_table_offset.to_le_bytes());
        bytes.extend_from_slice(&self.artist_table_offset.to_le_bytes());
        bytes.extend_from_slice(&self.album_table_offset.to_le_bytes());
        bytes.extend_from_slice(&self.song_table_offset.to_le_bytes());
        // Reserved 4 bytes for future use
        bytes.extend_from_slice(&0u32.to_le_bytes());
        bytes
    }

    /// Parse header from bytes.
    #[allow(dead_code)]
    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() < HEADER_SIZE as usize {
            return None;
        }

        let magic: [u8; 4] = bytes[0..4].try_into().ok()?;
        if &magic != LIBRARY_MAGIC {
            return None;
        }

        Some(Self {
            magic,
            version: u32::from_le_bytes(bytes[4..8].try_into().ok()?),
            song_count: u32::from_le_bytes(bytes[8..12].try_into().ok()?),
            artist_count: u32::from_le_bytes(bytes[12..16].try_into().ok()?),
            album_count: u32::from_le_bytes(bytes[16..20].try_into().ok()?),
            string_table_offset: u32::from_le_bytes(bytes[20..24].try_into().ok()?),
            artist_table_offset: u32::from_le_bytes(bytes[24..28].try_into().ok()?),
            album_table_offset: u32::from_le_bytes(bytes[28..32].try_into().ok()?),
            song_table_offset: u32::from_le_bytes(bytes[32..36].try_into().ok()?),
        })
    }
}

/// Information about the current library state.
/// Returned to the frontend to display library status.
#[derive(Debug, Clone, Serialize)]
pub struct LibraryInfo {
    pub initialized: bool,
    pub jp3_path: Option<String>,
    pub music_buckets: u32,
    pub has_library_bin: bool,
}

impl LibraryInfo {
    /// Create an uninitialized library info.
    pub fn uninitialized() -> Self {
        Self {
            initialized: false,
            jp3_path: None,
            music_buckets: 0,
            has_library_bin: false,
        }
    }
}

/// Artist table entry (8 bytes).
///
/// Binary layout:
/// ```text
/// Offset  Size  Field
/// 0x00    4     name_string_id
/// 0x04    4     reserved
/// ```
#[derive(Debug, Clone)]
pub struct ArtistEntry {
    pub name_string_id: u32,
}

impl ArtistEntry {
    pub const SIZE: u32 = 8;

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(Self::SIZE as usize);
        bytes.extend_from_slice(&self.name_string_id.to_le_bytes());
        bytes.extend_from_slice(&0u32.to_le_bytes()); // reserved
        bytes
    }
}

/// Album table entry (16 bytes).
///
/// Binary layout:
/// ```text
/// Offset  Size  Field
/// 0x00    4     name_string_id
/// 0x04    4     artist_id
/// 0x08    2     year
/// 0x0A    6     reserved
/// ```
#[derive(Debug, Clone)]
pub struct AlbumEntry {
    pub name_string_id: u32,
    pub artist_id: u32,
    pub year: u16,
}

impl AlbumEntry {
    pub const SIZE: u32 = 16;

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(Self::SIZE as usize);
        bytes.extend_from_slice(&self.name_string_id.to_le_bytes());
        bytes.extend_from_slice(&self.artist_id.to_le_bytes());
        bytes.extend_from_slice(&self.year.to_le_bytes());
        bytes.extend_from_slice(&[0u8; 6]); // reserved
        bytes
    }
}

/// Song entry flags for soft delete support.
/// Using bitflags allows future expansion (e.g., favorites, hidden, etc.)
pub mod song_flags {
    /// Entry is active and valid
    pub const ACTIVE: u8 = 0x00;
    /// Entry has been soft-deleted (skip during reads)
    pub const DELETED: u8 = 0x01;
}

/// Song table entry (24 bytes).
///
/// Binary layout:
/// ```text
/// Offset  Size  Field
/// 0x00    4     title_string_id
/// 0x04    4     artist_id
/// 0x08    4     album_id
/// 0x0C    4     path_string_id (relative path in library)
/// 0x10    2     track_number
/// 0x12    2     duration_sec
/// 0x14    1     flags (0x00 = active, 0x01 = deleted)
/// 0x15    3     reserved
/// ```
#[derive(Debug, Clone)]
pub struct SongEntry {
    pub title_string_id: u32,
    pub artist_id: u32,
    pub album_id: u32,
    pub path_string_id: u32,
    pub track_number: u16,
    pub duration_sec: u16,
    pub flags: u8,
}

impl SongEntry {
    pub const SIZE: u32 = 24;

    /// Create a new active song entry.
    pub fn new(
        title_string_id: u32,
        artist_id: u32,
        album_id: u32,
        path_string_id: u32,
        track_number: u16,
        duration_sec: u16,
    ) -> Self {
        Self {
            title_string_id,
            artist_id,
            album_id,
            path_string_id,
            track_number,
            duration_sec,
            flags: song_flags::ACTIVE,
        }
    }

    /// Check if this entry is deleted.
    pub fn is_deleted(&self) -> bool {
        self.flags & song_flags::DELETED != 0
    }

    /// Check if this entry is active (not deleted).
    pub fn is_active(&self) -> bool {
        !self.is_deleted()
    }

    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(Self::SIZE as usize);
        bytes.extend_from_slice(&self.title_string_id.to_le_bytes());
        bytes.extend_from_slice(&self.artist_id.to_le_bytes());
        bytes.extend_from_slice(&self.album_id.to_le_bytes());
        bytes.extend_from_slice(&self.path_string_id.to_le_bytes());
        bytes.extend_from_slice(&self.track_number.to_le_bytes());
        bytes.extend_from_slice(&self.duration_sec.to_le_bytes());
        bytes.push(self.flags);
        bytes.extend_from_slice(&[0u8; 3]); // reserved
        bytes
    }

    /// Parse a song entry from bytes.
    pub fn from_bytes(data: &[u8]) -> Option<Self> {
        if data.len() < Self::SIZE as usize {
            return None;
        }
        Some(Self {
            title_string_id: u32::from_le_bytes(data[0..4].try_into().ok()?),
            artist_id: u32::from_le_bytes(data[4..8].try_into().ok()?),
            album_id: u32::from_le_bytes(data[8..12].try_into().ok()?),
            path_string_id: u32::from_le_bytes(data[12..16].try_into().ok()?),
            track_number: u16::from_le_bytes(data[16..18].try_into().ok()?),
            duration_sec: u16::from_le_bytes(data[18..20].try_into().ok()?),
            flags: data[20],
        })
    }
}

/// String table for deduplicating strings.
///
/// Binary format: Each string is stored as:
/// - 2 bytes: length (u16)
/// - N bytes: UTF-8 string data (NOT null-terminated)
#[derive(Debug, Clone, Default)]
pub struct StringTable {
    strings: Vec<String>,
    lookup: std::collections::HashMap<String, u32>,
}

impl StringTable {
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a StringTable from existing strings (for loading from library.bin).
    pub fn from_vec(strings: Vec<String>) -> Self {
        let mut lookup = std::collections::HashMap::new();
        for (id, s) in strings.iter().enumerate() {
            lookup.insert(s.clone(), id as u32);
        }
        Self { strings, lookup }
    }

    /// Add a string and return its ID.
    /// Returns existing ID if string already present (deduplication).
    pub fn add(&mut self, s: &str) -> u32 {
        if let Some(&id) = self.lookup.get(s) {
            return id;
        }
        let id = self.strings.len() as u32;
        self.strings.push(s.to_string());
        self.lookup.insert(s.to_string(), id);
        id
    }

    /// Get a string by ID.
    #[allow(dead_code)]
    pub fn get(&self, id: u32) -> Option<&str> {
        self.strings.get(id as usize).map(|s| s.as_str())
    }

    /// Check if a string exists and return its ID without adding it.
    pub fn get_or_peek(&self, s: &str) -> Option<u32> {
        self.lookup.get(s).copied()
    }

    /// Serialize to bytes.
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::new();
        for s in &self.strings {
            let s_bytes = s.as_bytes();
            let len = s_bytes.len() as u16;
            bytes.extend_from_slice(&len.to_le_bytes());
            bytes.extend_from_slice(s_bytes);
        }
        bytes
    }

    pub fn len(&self) -> usize {
        self.strings.len()
    }

    #[allow(dead_code)]
    pub fn is_empty(&self) -> bool {
        self.strings.is_empty()
    }
}

/// Result returned after saving files to the library.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveToLibraryResult {
    pub files_saved: u32,
    pub artists_added: u32,
    pub albums_added: u32,
    pub songs_added: u32,
    pub duplicates_skipped: u32,
    /// IDs of the newly saved songs (for adding to playlists)
    pub song_ids: Vec<u32>,
    /// IDs of existing songs that were duplicates (for adding to playlists)
    /// These songs already exist in the library but can still be added to a playlist
    pub duplicate_song_ids: Vec<u32>,
}

/// Parsed artist data for frontend display.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedArtist {
    pub id: u32,
    pub name: String,
}

/// Parsed album data for frontend display.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedAlbum {
    pub id: u32,
    pub name: String,
    pub artist_id: u32,
    pub artist_name: String,
    pub year: u16,
}

/// Parsed song data for frontend display.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedSong {
    pub id: u32,
    pub title: String,
    pub artist_id: u32,
    pub artist_name: String,
    pub album_id: u32,
    pub album_name: String,
    pub path: String,
    pub track_number: u16,
    pub duration_sec: u16,
}

/// Complete parsed library data for frontend display.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedLibrary {
    pub version: u32,
    pub artists: Vec<ParsedArtist>,
    pub albums: Vec<ParsedAlbum>,
    pub songs: Vec<ParsedSong>,
}

/// Result returned after deleting songs from the library.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteSongsResult {
    /// Number of songs successfully marked as deleted
    pub songs_deleted: u32,
    /// Song IDs that were not found
    pub not_found: Vec<u32>,
    /// Number of audio files deleted from music/
    pub files_deleted: u32,
}

/// Result returned after editing a song's metadata.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditSongResult {
    /// The new song ID after edit (old one is soft-deleted, new one appended)
    pub new_song_id: u32,
    /// Whether a new artist was created
    pub artist_created: bool,
    /// Whether a new album was created
    pub album_created: bool,
}

/// Library statistics for compaction decision.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStats {
    /// Total songs (including deleted)
    pub total_songs: u32,
    /// Active songs (not deleted)
    pub active_songs: u32,
    /// Deleted songs
    pub deleted_songs: u32,
    /// Total artists
    pub total_artists: u32,
    /// Total albums
    pub total_albums: u32,
    /// Total strings in string table
    pub total_strings: u32,
    /// Percentage of deleted songs (0-100)
    pub deleted_percentage: f32,
    /// Recommended to compact (deleted > 20%)
    pub should_compact: bool,
    /// File size in bytes
    pub file_size_bytes: u64,
}

/// Result returned after compacting the library.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompactResult {
    /// Songs removed (were soft-deleted)
    pub songs_removed: u32,
    /// Orphaned artists removed
    pub artists_removed: u32,
    /// Orphaned albums removed
    pub albums_removed: u32,
    /// Orphaned strings removed
    pub strings_removed: u32,
    /// Playlists updated (song IDs remapped)
    pub playlists_updated: u32,
    /// Old file size
    pub old_size_bytes: u64,
    /// New file size
    pub new_size_bytes: u64,
    /// Bytes saved
    pub bytes_saved: u64,
}
