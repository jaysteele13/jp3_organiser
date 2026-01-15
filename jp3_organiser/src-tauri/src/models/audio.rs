//! Audio file models for tracking and metadata extraction.
//!
//! These models are used during the upload/processing pipeline:
//! 1. User selects files -> assigned TrackingId
//! 2. ID3 metadata extraction -> MetadataStatus determined
//! 3. (Future) AI/API enrichment for incomplete metadata
//! 4. Manual confirmation for remaining incomplete
//! 5. Duplicate detection
//! 6. Final write to library.bin

use serde::{Deserialize, Serialize};

/// Status of metadata extraction for a tracked audio file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MetadataStatus {
    /// Waiting to be processed
    Pending,
    /// All required fields present (artist, album, title)
    Complete,
    /// Missing one or more required fields
    Incomplete,
    /// Failed to read file or parse metadata
    Error,
    /// Successfully processed
    Success,
    /// Failed during processing
    Failed,
}

impl Default for MetadataStatus {
    fn default() -> Self {
        Self::Pending
    }
}

/// Source of the metadata for a tracked audio file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MetadataSource {
    /// Source not yet determined
    Unknown,
    /// Metadata extracted from ID3 tags embedded in the file
    Id3,
    /// Metadata from audio fingerprint matching (Chromaprint -> AcoustID -> MusicBrainz)
    Fingerprint,
    /// Metadata entered manually by user
    Manual,
}

impl Default for MetadataSource {
    fn default() -> Self {
        Self::Unknown
    }
}

/// Extracted metadata from an audio file.
/// All fields are optional since ID3 tags may be partially filled.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioMetadata {
    /// Song title
    pub title: Option<String>,
    /// Artist name
    pub artist: Option<String>,
    /// Album name
    pub album: Option<String>,
    /// Track number on album
    pub track_number: Option<u32>,
    /// Release year
    pub year: Option<i32>,
    /// Duration in seconds
    pub duration_secs: Option<u32>,
    /// MusicBrainz Release ID (for cover art fetching)
    pub release_mbid: Option<String>,
    /// MusicBrainz Artist ID ( for fanart tv fetching)
    pub artist_mbid: Option<String>,

}

impl AudioMetadata {
    /// Check if all required fields for library.bin are present.
    /// Required: title, artist, album
    pub fn is_complete(&self) -> bool {
        self.title.is_some() && self.artist.is_some() && self.album.is_some()
    }

    /// Get list of missing required fields.
    pub fn missing_fields(&self) -> Vec<&'static str> {
        let mut missing = Vec::new();
        if self.title.is_none() {
            missing.push("title");
        }
        if self.artist.is_none() {
            missing.push("artist");
        }
        if self.album.is_none() {
            missing.push("album");
        }
        missing
    }
}

/// A tracked audio file in the upload pipeline.
///
/// Each file gets a unique tracking ID for the session,
/// allowing us to reference specific files during processing.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackedAudioFile {
    /// Unique identifier for this file in the current session
    pub tracking_id: String,
    /// Original file path
    pub file_path: String,
    /// Just the filename (no directory)
    pub file_name: String,
    /// File extension (mp3, wav, etc.)
    pub file_extension: String,
    /// File size in bytes
    pub file_size: u64,
    /// Current metadata extraction status
    pub metadata_status: MetadataStatus,
    /// Source of the metadata (id3, acoustid, manual)
    pub metadata_source: MetadataSource,
    /// Extracted metadata (if any)
    pub metadata: AudioMetadata,
    /// Error message if status is Error
    pub error_message: Option<String>,
}

impl TrackedAudioFile {
    /// Create a new tracked file with pending status.
    pub fn new(tracking_id: String, file_path: String) -> Self {
        let path = std::path::Path::new(&file_path);
        let file_name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        let file_extension = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        let file_size = std::fs::metadata(&file_path).map(|m| m.len()).unwrap_or(0);

        Self {
            tracking_id,
            file_path,
            file_name,
            file_extension,
            file_size,
            metadata_status: MetadataStatus::Pending,
            metadata_source: MetadataSource::Unknown,
            metadata: AudioMetadata::default(),
            error_message: None,
        }
    }

    /// Update status based on metadata completeness.
    pub fn update_status(&mut self) {
        if self.error_message.is_some() {
            self.metadata_status = MetadataStatus::Error;
        } else if self.metadata.is_complete() {
            self.metadata_status = MetadataStatus::Complete;
        } else {
            self.metadata_status = MetadataStatus::Incomplete;
        }
    }
}

/// Result of processing an audio file for fingerprinting.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessedAudioFingerprint {
    pub fingerprint_id: String,
    pub tracking_id: String,
    pub fingerprint_status: MetadataStatus,
    pub error_message: Option<String>,
    pub duration_seconds: u32,
}

#[derive(Debug, Clone)]
pub struct AudioFingerprintResult {
    pub fingerprint: String,
    pub duration_seconds: u32,
}

/// Result of processing multiple audio files.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessedFilesResult {
    /// All processed files with their status
    pub files: Vec<TrackedAudioFile>,
    /// Count of files with complete metadata
    pub complete_count: usize,
    /// Count of files with incomplete metadata
    pub incomplete_count: usize,
    /// Count of files with errors
    pub error_count: usize,
}

impl ProcessedFilesResult {
    pub fn from_files(files: Vec<TrackedAudioFile>) -> Self {
        let complete_count = files
            .iter()
            .filter(|f| f.metadata_status == MetadataStatus::Complete)
            .count();
        let incomplete_count = files
            .iter()
            .filter(|f| f.metadata_status == MetadataStatus::Incomplete)
            .count();
        let error_count = files
            .iter()
            .filter(|f| f.metadata_status == MetadataStatus::Error)
            .count();

        Self {
            files,
            complete_count,
            incomplete_count,
            error_count,
        }
    }
}
