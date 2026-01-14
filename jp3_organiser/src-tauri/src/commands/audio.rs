//! Audio file processing commands.
//!
//! Handles:
//! - Processing selected audio files
//! - Extracting ID3 metadata
//! - Assigning tracking IDs
//! - AcoustID lookups with rate limiting (2 requests/second)
use id3::{Tag, TagLike};
use std::path::Path;
use uuid::Uuid;

use crate::models::{AudioMetadata, MetadataStatus, MetadataSource, ProcessedFilesResult, TrackedAudioFile};
use crate::services::fingerprint_service::{lookup_acoustid, process_audio_fingerprint, rate_limit_delay};
use crate::services::metadata_ranking_service::extract_metadata_from_acoustic_json;

/// Get audio metadata from AcoustID API for a single file.
///
/// This is an async command that:
/// 1. Generates a fingerprint using fpcalc
/// 2. Looks up the fingerprint in AcoustID database
/// 3. Returns the raw JSON response
#[tauri::command]
pub async fn get_audio_metadata_from_acoustic_id(
    file_path: String,
    tracking_id: String,
) -> Result<serde_json::Value, String> {
    log::info!(
        "Starting AcousticID lookup for file: {} (tracking_id: {})",
        file_path,
        tracking_id
    );

    let audio_finger_print = process_audio_fingerprint(&file_path, tracking_id.clone());

    log::info!(
        "Fingerprint result - status: {:?}, duration: {}s, fingerprint length: {}",
        audio_finger_print.fingerprint_status,
        audio_finger_print.duration_seconds,
        audio_finger_print.fingerprint_id.len()
    );

    if audio_finger_print.fingerprint_status == MetadataStatus::Failed {
        let error_msg = audio_finger_print
            .error_message
            .unwrap_or_else(|| "Unknown fingerprint error".to_string());
        log::error!("Fingerprint processing failed: {}", error_msg);
        return Err(error_msg);
    }

    log::info!(
        "Making AcousticID API request with fingerprint (length: {}, duration: {}s)",
        audio_finger_print.fingerprint_id.len(),
        audio_finger_print.duration_seconds
    );

    let result_json = lookup_acoustid(&audio_finger_print).await.map_err(|e| {
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
/// 3. Looks up in AcoustID with rate limiting (500ms between API calls)
/// 4. Determines metadata status (Complete/Incomplete/Error)
///
/// Returns all files with their tracking info and metadata status.
///
/// **Rate Limiting**: API calls are spaced 500ms apart to stay under
/// the 3 requests/second limit. With retry logic, this ensures we
/// don't get rate limited even under heavy use.
#[tauri::command]
pub async fn process_audio_files(file_paths: Vec<String>) -> Result<ProcessedFilesResult, String> {
    let mut tracked_files: Vec<TrackedAudioFile> = Vec::with_capacity(file_paths.len());
    let total_files = file_paths.len();

    for (index, file_path) in file_paths.into_iter().enumerate() {
        log::info!(
            "Processing file {}/{}: {}",
            index + 1,
            total_files,
            file_path
        );

        let tracking_id = Uuid::new_v4().to_string();
        let mut tracked_file = TrackedAudioFile::new(tracking_id.clone(), file_path.clone());

        log::info!("File extension: {}", tracked_file.file_extension);

        // Extract metadata based on file extension
        match tracked_file.file_extension.as_str() {
            "mp3" => {
                log::info!("Extracting ID3 metadata for MP3 file");
                extract_id3_metadata(&mut tracked_file);
                // Mark as ID3 source initially (may be overwritten by AcoustID)
                if tracked_file.metadata.is_complete() {
                    tracked_file.metadata_source = MetadataSource::Id3;
                }
            }
            "wav" | "flac" | "m4a" | "ogg" | "opus" => {
                log::info!(
                    "Skipping ID3 extraction for {} file (not supported yet)",
                    tracked_file.file_extension
                );
                // Mark as incomplete but don't set error_message - we'll try AcoustID
                tracked_file.metadata_status = MetadataStatus::Incomplete;
            }
            _ => {
                log::warn!("Unsupported file format: {}", tracked_file.file_extension);
                tracked_file.metadata_status = MetadataStatus::Error;
                tracked_file.error_message = Some("Unsupported file format".to_string());
            }
        }

        // Apply rate limiting before API call (except for first file)
        if index > 0 {
            rate_limit_delay().await;
        }

        // Generate fingerprint
        let audio_finger_print = process_audio_fingerprint(&file_path, tracking_id);

        if audio_finger_print.fingerprint_status == MetadataStatus::Failed {
            log::error!(
                "Fingerprint processing failed for file: {}",
                file_path
            );
            if tracked_file.error_message.is_none() {
                tracked_file.error_message = audio_finger_print.error_message;
            }
            tracked_files.push(tracked_file);
            continue;
        }

        // Lookup in AcoustID
        log::info!(
            "Calling AcousticID API for file: {} (fingerprint length: {})",
            file_path,
            audio_finger_print.fingerprint_id.len()
        );

        match lookup_acoustid(&audio_finger_print).await {
            Ok(result_json) => {
                log::info!("Successfully got AcousticID result for file: {}", file_path);

                // Parse and rank the JSON to gather the correct metadata
                match extract_metadata_from_acoustic_json(&result_json) {
                    Ok(extracted_metadata) => {
                        log::info!(
                            "Extracted metadata from AcousticID JSON for file: {}",
                            file_path
                        );
                        tracked_file.metadata = extracted_metadata;
                        tracked_file.metadata_source = MetadataSource::Fingerprint;
                        tracked_file.update_status();
                        log::info!("Final metadata: {:?}", tracked_file.metadata);
                    }
                    Err(e) => {
                        log::error!(
                            "Failed to extract metadata from AcousticID JSON for file: {}: {}",
                            file_path,
                            e
                        );
                        // Keep ID3 source if we had it, otherwise mark as unknown
                        if tracked_file.error_message.is_none() {
                            tracked_file.error_message =
                                Some(format!("Metadata extraction failed: {}", e));
                        }
                    }
                }
            }
            Err(e) => {
                log::error!(
                    "Failed to get metadata from AcousticID for file: {}: {}",
                    file_path,
                    e
                );
                // Keep ID3 source if we had it, otherwise mark as unknown
                if tracked_file.error_message.is_none() {
                    tracked_file.error_message = Some(format!("AcousticID lookup failed: {}", e));
                }
            }
        }

        tracked_files.push(tracked_file);
    }

    log::info!(
        "Finished processing {} files",
        tracked_files.len()
    );

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
                release_mbid: None, // ID3 tags don't contain MBID
            };
            tracked_file.update_status();
            log::info!(
                "ID3 data extracted: {:?}",
                tag.artist().map(|s| s.to_string())
            );
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

/// Process a single audio file with fingerprinting and AcoustID lookup.
///
/// This command is designed to be called repeatedly from the frontend,
/// allowing files to be displayed as they are processed rather than
/// waiting for all files to complete.
///
/// The frontend is responsible for rate limiting by waiting between calls.
/// Recommended: wait 500ms between calls to stay under AcoustID's 3/sec limit.
#[tauri::command]
pub async fn process_single_audio_file(file_path: String) -> Result<TrackedAudioFile, String> {
    log::info!("Processing single file: {}", file_path);

    let tracking_id = Uuid::new_v4().to_string();
    let mut tracked_file = TrackedAudioFile::new(tracking_id.clone(), file_path.clone());

    log::info!("File extension: {}", tracked_file.file_extension);

    // Extract metadata based on file extension
    match tracked_file.file_extension.as_str() {
        "mp3" => {
            log::info!("Extracting ID3 metadata for MP3 file");
            extract_id3_metadata(&mut tracked_file);
            // Mark as ID3 source initially (may be overwritten by AcoustID)
            if tracked_file.metadata.is_complete() {
                tracked_file.metadata_source = MetadataSource::Id3;
            }
        }
        "wav" | "flac" | "m4a" | "ogg" | "opus" => {
            log::info!(
                "Skipping ID3 extraction for {} file (not supported yet)",
                tracked_file.file_extension
            );
            tracked_file.metadata_status = MetadataStatus::Incomplete;
        }
        _ => {
            log::warn!("Unsupported file format: {}", tracked_file.file_extension);
            tracked_file.metadata_status = MetadataStatus::Error;
            tracked_file.error_message = Some("Unsupported file format".to_string());
            return Ok(tracked_file);
        }
    }

    // Generate fingerprint for Acoustic ID
    let audio_finger_print = process_audio_fingerprint(&file_path, tracking_id);

    if audio_finger_print.fingerprint_status == MetadataStatus::Failed {
        log::error!("Fingerprint processing failed for file: {}", file_path);
        if tracked_file.error_message.is_none() {
            tracked_file.error_message = audio_finger_print.error_message;
        }
        return Ok(tracked_file);
    }

    // Lookup in AcoustID
    log::info!(
        "Calling AcousticID API for file: {} (fingerprint length: {})",
        file_path,
        audio_finger_print.fingerprint_id.len()
    );

    // If we get a match from AcousticID, extract and rank the metadata
    match lookup_acoustid(&audio_finger_print).await {
        Ok(result_json) => {
            log::info!("Successfully got AcousticID result for file: {}", file_path);

            // We extract the metatdata from the Ranking System function
            match extract_metadata_from_acoustic_json(&result_json) {
                Ok(extracted_metadata) => {
                    log::info!(
                        "Extracted metadata from AcousticID JSON for file: {}",
                        file_path
                    );
                    tracked_file.metadata = extracted_metadata;
                    tracked_file.metadata_source = MetadataSource::Fingerprint;
                    tracked_file.update_status();
                    log::info!("Final metadata: {:?}", tracked_file.metadata);
                }
                Err(e) => {
                    log::error!(
                        "Failed to extract metadata from AcousticID JSON for file: {}: {}",
                        file_path,
                        e
                    );
                    // Keep ID3 source if we had it, otherwise mark as unknown
                    if tracked_file.error_message.is_none() {
                        tracked_file.error_message =
                            Some(format!("Metadata extraction failed: {}", e));
                    }
                }
            }
        }
        Err(e) => {
            log::error!(
                "Failed to get metadata from AcousticID for file: {}: {}",
                file_path,
                e
            );
            // Keep ID3 source if we had it, otherwise mark as unknown
            if tracked_file.error_message.is_none() {
                tracked_file.error_message = Some(format!("AcousticID lookup failed: {}", e));
            }
        }
    }

    log::info!("Finished processing file: {}", file_path);
    Ok(tracked_file)
}

/// Get metadata for a single audio file by its path (ID3 only, no AcoustID).
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
