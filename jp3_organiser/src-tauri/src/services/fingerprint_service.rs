//! Use fpcalc (Chromaprint command-line tool) for fingerprinting
//!
//! Requires fpcalc to be installed:
//! - Ubuntu/Debian: sudo apt install fpcalc
//! - macOS: brew install fpcalc
//! - Windows: Download from https://acoustid.org/chromaprint
use std::path::Path;
use std::env::var;
use std::process::Command;

use crate::models::{MetadataStatus, ProcessedAudioFingerprint };

/// Output format from fpcalc command
#[derive(Debug, serde::Deserialize)]
struct FpcalcOutput {
    duration: f64,
    fingerprint: String,
}

pub fn lookup_acoustid(fingerprint_result: &ProcessedAudioFingerprint) -> anyhow::Result<serde_json::Value> {
    log::info!("lookup_acoustid called with fingerprint_id: {} (length: {}), duration: {}s",
        &fingerprint_result.fingerprint_id[..std::cmp::min(20, fingerprint_result.fingerprint_id.len())],
        fingerprint_result.fingerprint_id.len(),
        fingerprint_result.duration_seconds
    );

    let client = reqwest::blocking::Client::new();

    let api_key = var("ACOUSTIC_ID_API_KEY").map_err(|e| {
        log::error!("ACOUSTIC_ID_API_KEY environment variable not set: {}", e);
        e
    })?;

    log::info!("Sending GET request to https://api.acoustid.org/v2/lookup");

    let res = client
        .get("https://api.acoustid.org/v2/lookup")
        .query(&[
            ("client", api_key.as_str()),
            ("format", "json"),
            ("meta", "recordings"),
            ("duration", &fingerprint_result.duration_seconds.to_string()),
            ("fingerprint", &fingerprint_result.fingerprint_id),
        ])
        .send()
        .map_err(|e| {
            log::error!("Failed to send request to AcousticID API: {}", e);
            anyhow::anyhow!("Request failed: {}", e)
        })?;

    log::info!("Received response from AcousticID API");

    let response_text = res.text().map_err(|e| {
        log::error!("Failed to read response body: {}", e);
        anyhow::anyhow!("Failed to read response: {}", e)
    })?;

    log::info!("Response body (first 200 chars): {}",
        &response_text[..std::cmp::min(200, response_text.len())]
    );

    let json: serde_json::Value = serde_json::from_str(&response_text).map_err(|e| {
        log::error!("Failed to parse JSON response: {}", e);
        log::error!("Response was: {}", response_text);
        anyhow::anyhow!("Failed to parse JSON: {}", e)
    })?;

    log::info!("Successfully parsed AcousticID response");
    Ok(json)
}


fn inner_process_audio_fingerprint<P: AsRef<Path>>(
    path: P,
) -> anyhow::Result<(String, u32)> {
    let path_ref = path.as_ref();
    log::info!("Running fpcalc on file: {:?}", path_ref);

    let output = Command::new("fpcalc")
        .arg("-json")
        .arg("-length")
        .arg("30")
        .arg(path_ref)
        .output()
        .map_err(|e| {
            log::error!("Failed to execute fpcalc command: {}", e);
            anyhow::anyhow!("Failed to run fpcalc: {}. Ensure fpcalc is installed (apt install fpcalc or brew install fpcalc)", e)
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        log::error!("fpcalc failed with status: {}", output.status);
        log::error!("stderr: {}", stderr);
        return Err(anyhow::anyhow!("fpcalc failed: {}", stderr));
    }

    let stdout = String::from_utf8(output.stdout)
        .map_err(|e| {
            log::error!("Failed to parse fpcalc output as UTF-8: {}", e);
            anyhow::anyhow!("Invalid fpcalc output: {}", e)
        })?;

    log::debug!("fpcalc output: {}", stdout);

    let fpcalc_result: FpcalcOutput = serde_json::from_str(&stdout)
        .map_err(|e| {
            log::error!("Failed to parse fpcalc JSON output: {}", e);
            log::error!("Output was: {}", stdout);
            anyhow::anyhow!("Invalid fpcalc JSON: {}", e)
        })?;

    log::info!("fpcalc result - duration: {:.2}s, fingerprint length: {}",
        fpcalc_result.duration,
        fpcalc_result.fingerprint.len()
    );

    Ok((fpcalc_result.fingerprint, fpcalc_result.duration as u32))
}


pub fn process_audio_fingerprint<P: AsRef<Path>>(
    path: P,
    tracking_id: String,
) -> ProcessedAudioFingerprint {
    log::info!("process_audio_fingerprint called for path: {:?}, tracking_id: {}", path.as_ref(), tracking_id);

    match inner_process_audio_fingerprint(path) {
        Ok((fingerprint, duration)) => {
            log::info!("Fingerprint processed successfully - duration: {}s, fingerprint length: {}",
                duration,
                fingerprint.len()
            );
            ProcessedAudioFingerprint {
                fingerprint_id: fingerprint,
                tracking_id,
                fingerprint_status: MetadataStatus::Success,
                error_message: None,
                duration_seconds: duration,
            }
        }
        Err(err) => {
            log::error!("Failed to process audio fingerprint: {}", err);
            ProcessedAudioFingerprint {
                fingerprint_id: String::new(),
                tracking_id,
                fingerprint_status: MetadataStatus::Failed,
                error_message: Some(err.to_string()),
                duration_seconds: 0,
            }
        }
    }
}
