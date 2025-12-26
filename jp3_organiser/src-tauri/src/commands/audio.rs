//! Audio file processing commands.
//!
//! Handles:
//! - Processing selected audio files
//! - Extracting ID3 metadata
//! - Assigning tracking IDs
use id3::{Tag, TagLike};
use std::path::Path;
use uuid::Uuid;

use crate::models::{AudioMetadata, MetadataStatus, ProcessedAudioFingerprint, TrackedAudioFile};
use crate::services::fingerprint_service::{process_audio_fingerprint, lookup_acoustid};





// Command that takes music data file and runs it against the open AcousticID API, we must get the audio fingerprint then can search the database
#[tauri::command]
pub fn get_audio_metadata_from_acoustic_id(file_path: String, tracking_id: String) -> Result<ProcessedAudioFingerprint, String> {
    // Placeholder for future implementation
    
    // Get Fingerprint from file thos returns:

    /*
    pub struct ProcessedAudioFingerprint {
    pub fingerprint_id: String,
    pub tracking_id: String,
    pub fingerprint_status: MetadataStatus,
    pub error_message: Option<String>,
}
    */
    let audioFingerPrint = match process_audio_fingerprint(&file_path, tracking_id.clone()) {
        Ok(result) => (result.fingerprint_id, result.duration_seconds),
        Err(e) => {
            return Err(format!("Failed to process audio fingerprint: {}", e));
        }
    };

    // use the fingerprint and duration to query the AcousticID API
    let resultJSON = lookup_acoustid(&audioFingerPrint).map_err(|e| format!("AcousticID lookup failed: {}", e))?;

    // log result
    log::info!("AcousticID lookup result: {:?}", resultJSON);
    return Ok(resultJSON);
    
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
        let tracking_id = Uuid::new_v4().to_string();
        let mut tracked_file = TrackedAudioFile::new(tracking_id, file_path.clone());

        // Extract metadata based on file extension
        match tracked_file.file_extension.as_str() {
            "mp3" => {
                extract_id3_metadata(&mut tracked_file);
            }
            "wav" | "flac" | "m4a" | "ogg" => {
                // For now, mark non-MP3 files as incomplete
                // TODO: Add support for other formats using appropriate libraries
                tracked_file.metadata_status = MetadataStatus::Incomplete;
                tracked_file.error_message = Some(format!(
                    "Metadata extraction not yet supported for .{} files",
                    tracked_file.file_extension
                ));
            }
            _ => {
                tracked_file.metadata_status = MetadataStatus::Error;
                tracked_file.error_message = Some("Unsupported file format".to_string());
            }
            let result = get_audio_metadata_from_acoustic_id(file_path.clone(), tracked_file.tracking_id.clone())?;

            // do stuff based off of the result -> fix tomorrow
        }

        // After ID3 Check, lets try metadata from AcousticID


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
