//! Audio file processing commands.
//!
//! Handles:
//! - Processing selected audio files
//! - Extracting ID3 metadata
//! - Assigning tracking IDs
use id3::{Tag, TagLike};
use std::path::Path;
use uuid::Uuid;

use crate::models::{AudioMetadata, MetadataStatus, ProcessedFilesResult, TrackedAudioFile};
use crate::services::fingerprint_service::{process_audio_fingerprint, lookup_acoustid};





// Command that takes music data file and runs it against the open AcousticID API, we must get the audio fingerprint then can search the database
#[tauri::command]
pub fn get_audio_metadata_from_acoustic_id(file_path: String, tracking_id: String) -> Result<serde_json::Value, String> {
    log::info!("Starting AcousticID lookup for file: {} (tracking_id: {})", file_path, tracking_id);

    let audio_finger_print = process_audio_fingerprint(&file_path, tracking_id.clone());

    log::info!("Fingerprint result - status: {:?}, duration: {}s, fingerprint length: {}",
        audio_finger_print.fingerprint_status,
        audio_finger_print.duration_seconds,
        audio_finger_print.fingerprint_id.len()
    );

    if audio_finger_print.fingerprint_status == MetadataStatus::Failed {
        let error_msg = audio_finger_print.error_message.unwrap_or_else(|| "Unknown fingerprint error".to_string());
        log::error!("Fingerprint processing failed: {}", error_msg);
        return Err(error_msg);
    }

    log::info!("Making AcousticID API request with fingerprint (length: {}, duration: {}s)",
        audio_finger_print.fingerprint_id.len(),
        audio_finger_print.duration_seconds
    );

    let result_json = lookup_acoustid(&audio_finger_print).map_err(|e| {
        log::error!("AcousticID lookup failed: {}", e);
        format!("AcousticID lookup failed: {}", e)
    })?;

    log::info!("AcousticID lookup successful!");
    Ok(result_json)
}




/// Process a list of audio file paths.
/// 
/// For each file:
/// 1. Assigns a unique tracking ID
/// 2. Attempts to extract ID3 metadata
/// 3. Determines metadata status (Complete/Incomplete/Error)
/// 
/// Returns all files with their tracking info and metadata status.
#[tauri::command]
pub fn process_audio_files(file_paths: Vec<String>) -> Result<ProcessedFilesResult, String> {
    let mut tracked_files: Vec<TrackedAudioFile> = Vec::with_capacity(file_paths.len());

    for file_path in file_paths {
        log::info!("Processing file: {}", file_path);

        let tracking_id = Uuid::new_v4().to_string();
        let mut tracked_file = TrackedAudioFile::new(tracking_id, file_path.clone());

        log::info!("File extension: {}", tracked_file.file_extension);

        // Extract metadata based on file extension
        match tracked_file.file_extension.as_str() {
            "mp3" => {
                log::info!("Extracting ID3 metadata for MP3 file");
                extract_id3_metadata(&mut tracked_file);
            }
            "wav" | "flac" | "m4a" | "ogg" | "opus" => {
                log::info!("Skipping ID3 extraction for {} file (not supported yet)", tracked_file.file_extension);
                // Mark as incomplete but don't set error_message - we'll try AcousticID
                tracked_file.metadata_status = MetadataStatus::Incomplete;
            }
            _ => {
                log::warn!("Unsupported file format: {}", tracked_file.file_extension);
                tracked_file.metadata_status = MetadataStatus::Error;
                tracked_file.error_message = Some("Unsupported file format".to_string());
            }
        }

        log::info!("Calling get_audio_metadata_from_acoustic_id for file: {}", file_path);
        let acoustic_id_result = get_audio_metadata_from_acoustic_id(file_path.clone(), tracked_file.tracking_id.clone());
        log::info!("get_audio_metadata_from_acoustic_id completed for file: {}", file_path);

        match acoustic_id_result {
            Ok(result_json) => {
                log::info!("Successfully got AcousticID result for file: {}", file_path);
                // TODO: Parse the result and update tracked_file metadata
            }
            Err(e) => {
                log::error!("Failed to get metadata from AcousticID for file: {}: {}", file_path, e);
                // Don't fail the entire file processing, just log the error
                if tracked_file.error_message.is_none() {
                    tracked_file.error_message = Some(format!("AcousticID lookup failed: {}", e));
                }
            }
        }

        tracked_files.push(tracked_file);
    }

    Ok(ProcessedFilesResult::from_files(tracked_files))
}

/// Extract ID3 metadata from an MP3 file.
fn extract_id3_metadata(tracked_file: &mut TrackedAudioFile) {
    let path = Path::new(&tracked_file.file_path);

    match Tag::read_from_path(path) {
        Ok(tag) => {
            tracked_file.metadata = AudioMetadata {
                title: tag.title().map(|s| s.to_string()),
                artist: tag.artist().map(|s| s.to_string()),
                album: tag.album().map(|s| s.to_string()),
                track_number: tag.track(),
                year: tag.year(),
                duration_secs: tag.duration(),
            };
            tracked_file.update_status();
             log::info!("here is id3 data: {:?}", tag.artist().map(|s| s.to_string()));
        }
        Err(id3::Error {
            kind: id3::ErrorKind::NoTag,
            ..
        }) => {
            // File has no ID3 tag at all
            tracked_file.metadata = AudioMetadata::default();
            tracked_file.metadata_status = MetadataStatus::Incomplete;
        }
        Err(e) => {
            tracked_file.metadata_status = MetadataStatus::Error;
            tracked_file.error_message = Some(format!("Failed to read ID3 tag: {}", e));
        }
    }
}

/// Get metadata for a single audio file by its path.
#[tauri::command]
pub fn get_audio_metadata(file_path: String) -> Result<TrackedAudioFile, String> {
    let tracking_id = Uuid::new_v4().to_string();
    let mut tracked_file = TrackedAudioFile::new(tracking_id, file_path);

    if tracked_file.file_extension == "mp3" {
        extract_id3_metadata(&mut tracked_file);
    } else {
        tracked_file.metadata_status = MetadataStatus::Incomplete;
        tracked_file.error_message = Some(format!(
            "Metadata extraction not yet supported for .{} files",
            tracked_file.file_extension
        ));
    }

    Ok(tracked_file)
}
