//! Audio file processing commands.
//!
//! Handles:
//! - Processing selected audio files via metadata enrichment pipeline
//! - Assigning tracking IDs
//! - Rate limiting between API calls

use uuid::Uuid;

use crate::models::{ProcessedFilesResult, TrackedAudioFile};
use crate::services::fingerprint_service::rate_limit_delay;
use crate::services::metadata_enrichment_service;

/// Process a list of audio file paths.
///
/// For each file:
/// 1. Assigns a unique tracking ID
/// 2. Runs the full enrichment pipeline (fingerprint → AcoustID → ranking)
/// 3. Rate limits API calls (500ms between files)
///
/// Returns all files with their tracking info and metadata status.
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

        if index > 0 {
            rate_limit_delay().await;
        }

        let tracking_id = Uuid::new_v4().to_string();
        let tracked_file = TrackedAudioFile::new(tracking_id, file_path);
        let enriched = metadata_enrichment_service::enrich_from_fingerprint(tracked_file).await;
        tracked_files.push(enriched);
    }

    log::info!(
        "Finished processing {} files",
        tracked_files.len()
    );

    Ok(ProcessedFilesResult::from_files(tracked_files))
}

/// Process a single audio file with fingerprinting and AcoustID lookup.
///
/// This command is designed to be called repeatedly from the frontend,
/// allowing files to be displayed as they are processed rather than
/// waiting for all files to complete.
///
/// The frontend is responsible for rate limiting between calls.
/// Recommended: wait 500ms between calls to stay under AcoustID's 3/sec limit.
#[tauri::command]
pub async fn process_single_audio_file(file_path: String) -> Result<TrackedAudioFile, String> {
    log::info!("Processing single file: {}", file_path);

    let tracking_id = Uuid::new_v4().to_string();
    let tracked_file = TrackedAudioFile::new(tracking_id, file_path);
    let enriched = metadata_enrichment_service::enrich_from_fingerprint(tracked_file).await;

    log::info!("Finished processing file: {}", enriched.file_name);
    Ok(enriched)
}
