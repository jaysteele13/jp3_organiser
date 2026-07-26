//! Metadata enrichment service for audio files.
//!
//! Provides a single entry point for the metadata enrichment pipeline:
//! 1. Validate file extension
//! 2. Generate audio fingerprint (fpcalc)
//! 3. Look up fingerprint in AcoustID database
//! 4. Rank results and extract best metadata
//!
//! # Extensibility
//!
//! To add a new enrichment step (e.g., genre lookup, additional APIs):
//! 1. Create a new service in `services/`
//! 2. Add a step in `enrich_from_fingerprint()` after the existing steps
//! 3. No changes needed in the command layer (`commands/audio.rs`)
//!
//! # Rate Limiting
//!
//! Rate limiting is handled by the caller (command layer), not this service.
//! The service processes a single file and returns immediately.

use crate::models::{MetadataSource, MetadataStatus, TrackedAudioFile};
use crate::services::fingerprint_service;
use crate::services::metadata_ranking_service;

/// File extensions supported for metadata enrichment.
const SUPPORTED_EXTENSIONS: &[&str] = &["mp3", "wav", "flac", "m4a", "ogg", "opus"];

/// Enrich a TrackedAudioFile with metadata from AcoustID fingerprinting.
///
/// Takes ownership of the tracked file and returns it enriched with metadata.
/// On any failure, sets the error_message field and returns early.
///
/// # Pipeline Steps
///
/// 1. Validate file extension against allowlist
/// 2. Generate fingerprint via fpcalc
/// 3. Look up fingerprint in AcoustID
/// 4. Rank results and extract best metadata match
///
/// # Arguments
/// * `tracked_file` - Raw tracked audio file (owned, moved through pipeline)
///
/// # Returns
/// The same tracked file with metadata populated (or error set).
pub async fn enrich_from_fingerprint(
    tracked_file: TrackedAudioFile,
) -> TrackedAudioFile {
    let mut file = tracked_file;

    // Step 1: Validate file extension
    if !SUPPORTED_EXTENSIONS.contains(&file.file_extension.as_str()) {
        log::warn!("Unsupported file format: {}", file.file_extension);
        file.metadata_status = MetadataStatus::Error;
        file.error_message = Some(format!("Unsupported file format: .{}", file.file_extension));
        return file;
    }

    log::info!(
        "Enriching file: {} (ext: {})",
        file.file_name,
        file.file_extension
    );

    // Step 2: Generate fingerprint
    let audio_fingerprint =
        fingerprint_service::process_audio_fingerprint(&file.file_path, file.tracking_id.clone());

    if audio_fingerprint.fingerprint_status == MetadataStatus::Failed {
        log::error!(
            "Fingerprint processing failed for file: {}",
            file.file_path
        );
        file.error_message = audio_fingerprint.error_message;
        return file;
    }

    // Step 3: AcoustID lookup
    log::info!(
        "Calling AcoustID API for file: {} (fingerprint length: {})",
        file.file_name,
        audio_fingerprint.fingerprint_id.len()
    );

    match fingerprint_service::lookup_acoustid(&audio_fingerprint).await {
        Ok(result_json) => {
            log::info!(
                "Successfully got AcoustID result for file: {}",
                file.file_name
            );

            // Step 4: Rank and extract metadata
            match metadata_ranking_service::extract_metadata_from_acoustic_json(&result_json) {
                Ok(extracted_metadata) => {
                    log::info!(
                        "Extracted metadata from AcoustID for file: {}",
                        file.file_name
                    );
                    file.metadata = extracted_metadata;
                    file.metadata_source = MetadataSource::Fingerprint;
                    file.update_status();
                    log::info!("Final metadata: {:?}", file.metadata);
                }
                Err(e) => {
                    log::error!(
                        "Failed to extract metadata from AcoustID for file: {}: {}",
                        file.file_name,
                        e
                    );
                    if file.error_message.is_none() {
                        file.error_message =
                            Some(format!("Metadata extraction failed: {}", e));
                    }
                }
            }
        }
        Err(e) => {
            log::error!(
                "AcoustID lookup failed for file: {}: {}",
                file.file_name,
                e
            );
            if file.error_message.is_none() {
                file.error_message = Some(format!("AcoustID lookup failed: {}", e));
            }
        }
    }

    file
}
