//! Use fpcalc (Chromaprint command-line tool) for fingerprinting
//!
//! Requires fpcalc to be installed:
//! - Ubuntu/Debian: sudo apt install fpcalc
//! - macOS: brew install fpcalc
//! - Windows: Download from https://acoustid.org/chromaprint
use std::path::Path;
use std::env::var;
use std::process::Command;
use std::time::Duration;

use tokio::time::sleep;

use crate::models::{MetadataStatus, ProcessedAudioFingerprint};

/// Delay between API calls to stay under the 3/second rate limit
/// Using 500ms = 2 requests/second for safety margin
const API_CALL_DELAY_MS: u64 = 500;

/// Delay before retrying after an API error
const RETRY_DELAY_MS: u64 = 1000;

/// Maximum number of retry attempts
const MAX_RETRIES: u32 = 1;

/// Output format from fpcalc command
#[derive(Debug, serde::Deserialize)]
struct FpcalcOutput {
    duration: f64,
    fingerprint: String,
}

/// AcoustID API error response
#[derive(Debug, serde::Deserialize)]
struct AcoustIdErrorResponse {
    #[allow(dead_code)]
    status: String,
    error: Option<AcoustIdError>,
}

#[derive(Debug, serde::Deserialize)]
struct AcoustIdError {
    code: Option<i32>,
    message: Option<String>,
}

/// Errors that can occur during AcoustID lookup
#[derive(Debug)]
pub enum AcoustIdLookupError {
    /// Network or request error
    RequestError(String),
    /// API returned an error response (may be retriable)
    ApiError { code: Option<i32>, message: String },
    /// Failed to parse response
    ParseError(String),
    /// Missing API key
    ConfigError(String),
}

impl std::fmt::Display for AcoustIdLookupError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AcoustIdLookupError::RequestError(msg) => write!(f, "Request failed: {}", msg),
            AcoustIdLookupError::ApiError { code, message } => {
                if let Some(c) = code {
                    write!(f, "API error (code {}): {}", c, message)
                } else {
                    write!(f, "API error: {}", message)
                }
            }
            AcoustIdLookupError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            AcoustIdLookupError::ConfigError(msg) => write!(f, "Config error: {}", msg),
        }
    }
}

impl std::error::Error for AcoustIdLookupError {}

/// Check if the error is potentially retriable (rate limit, server error, etc.)
fn is_retriable_error(error: &AcoustIdLookupError) -> bool {
    match error {
        AcoustIdLookupError::ApiError { code, .. } => {
            // Retry on rate limit (429) or server errors (5xx)
            matches!(code, Some(429) | Some(500..=599))
        }
        AcoustIdLookupError::RequestError(_) => {
            // Network errors might be transient
            true
        }
        _ => false,
    }
}

/// Performs the actual API lookup (single attempt)
async fn lookup_acoustid_once(
    client: &reqwest::Client,
    fingerprint_result: &ProcessedAudioFingerprint,
    api_key: &str,
) -> Result<serde_json::Value, AcoustIdLookupError> {
    log::info!("Sending GET request to https://api.acoustid.org/v2/lookup");

    let res = client
        .get("https://api.acoustid.org/v2/lookup")
        .query(&[
            ("client", api_key),
            ("format", "json"),
            ("meta", "recordings releasegroups compress sources releases"),
            ("duration", &fingerprint_result.duration_seconds.to_string()),
            ("fingerprint", &fingerprint_result.fingerprint_id),
        ])
        .send()
        .await
        .map_err(|e| {
            log::error!("Failed to send request to AcousticID API: {}", e);
            AcoustIdLookupError::RequestError(e.to_string())
        })?;

    let status = res.status();
    let response_text = res.text().await.map_err(|e| {
        log::error!("Failed to read response body: {}", e);
        AcoustIdLookupError::RequestError(format!("Failed to read response: {}", e))
    })?;

    // Check for HTTP-level errors
    if !status.is_success() {
        log::error!("HTTP error {}: {}", status.as_u16(), response_text);
        return Err(AcoustIdLookupError::ApiError {
            code: Some(status.as_u16() as i32),
            message: format!("HTTP {}: {}", status.as_u16(), response_text),
        });
    }

    let json: serde_json::Value = serde_json::from_str(&response_text).map_err(|e| {
        log::error!("Failed to parse JSON response: {}", e);
        log::error!("Response was: {}", response_text);
        AcoustIdLookupError::ParseError(format!("Failed to parse JSON: {}", e))
    })?;

    // Check for API-level errors in the response body
    if let Some(status_str) = json.get("status").and_then(|s| s.as_str()) {
        if status_str == "error" {
            let error_info: AcoustIdErrorResponse =
                serde_json::from_value(json.clone()).unwrap_or(AcoustIdErrorResponse {
                    status: "error".to_string(),
                    error: None,
                });

            let code = error_info.error.as_ref().and_then(|e| e.code);
            let message = error_info
                .error
                .and_then(|e| e.message)
                .unwrap_or_else(|| "Unknown API error".to_string());

            log::error!("AcoustID API error: code={:?}, message={}", code, message);
            return Err(AcoustIdLookupError::ApiError { code, message });
        }
    }

    log::info!("Successfully parsed AcousticID response");
    Ok(json)
}

/// Lookup fingerprint in AcoustID database with retry logic.
///
/// - Retries once after 1 second if the API returns a retriable error
/// - Returns the JSON response on success
pub async fn lookup_acoustid(
    fingerprint_result: &ProcessedAudioFingerprint,
) -> Result<serde_json::Value, AcoustIdLookupError> {
    log::info!(
        "lookup_acoustid called with fingerprint_id: {} (length: {}), duration: {}s",
        &fingerprint_result.fingerprint_id
            [..std::cmp::min(20, fingerprint_result.fingerprint_id.len())],
        fingerprint_result.fingerprint_id.len(),
        fingerprint_result.duration_seconds
    );

    // let api_key = var("ACOUSTIC_ID_API_KEY").map_err(|e| {
    //     log::error!("ACOUSTIC_ID_API_KEY environment variable not set: {}", e);
    //     AcoustIdLookupError::ConfigError("ACOUSTIC_ID_API_KEY not set".to_string())
    // })?;
    let api_key = env!("ACOUSTIC_ID_API_KEY");

    let client = reqwest::Client::new();

    let mut last_error = None;

    for attempt in 0..=MAX_RETRIES {
        if attempt > 0 {
            log::info!(
                "Retry attempt {} after {}ms delay",
                attempt,
                RETRY_DELAY_MS
            );
            sleep(Duration::from_millis(RETRY_DELAY_MS)).await;
        }

        match lookup_acoustid_once(&client, fingerprint_result, &api_key).await {
            Ok(json) => {
                log::info!("AcousticID lookup successful on attempt {}", attempt + 1);
                return Ok(json);
            }
            Err(e) => {
                log::warn!("AcousticID lookup failed on attempt {}: {}", attempt + 1, e);

                if is_retriable_error(&e) && attempt < MAX_RETRIES {
                    last_error = Some(e);
                    continue;
                }

                return Err(e);
            }
        }
    }

    // Should not reach here, but just in case
    Err(last_error.unwrap_or_else(|| {
        AcoustIdLookupError::RequestError("Unknown error after retries".to_string())
    }))
}

/// Enforce rate limiting by sleeping for the configured delay.
/// Call this before each API request when processing multiple files.
pub async fn rate_limit_delay() {
    log::debug!("Rate limiting: waiting {}ms before next API call", API_CALL_DELAY_MS);
    sleep(Duration::from_millis(API_CALL_DELAY_MS)).await;
}

fn inner_process_audio_fingerprint<P: AsRef<Path>>(path: P) -> anyhow::Result<(String, u32)> {
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

    let stdout = String::from_utf8(output.stdout).map_err(|e| {
        log::error!("Failed to parse fpcalc output as UTF-8: {}", e);
        anyhow::anyhow!("Invalid fpcalc output: {}", e)
    })?;

    log::debug!("fpcalc output: {}", stdout);

    let fpcalc_result: FpcalcOutput = serde_json::from_str(&stdout).map_err(|e| {
        log::error!("Failed to parse fpcalc JSON output: {}", e);
        log::error!("Output was: {}", stdout);
        anyhow::anyhow!("Invalid fpcalc JSON: {}", e)
    })?;

    log::info!(
        "fpcalc result - duration: {:.2}s, fingerprint length: {}",
        fpcalc_result.duration,
        fpcalc_result.fingerprint.len()
    );

    Ok((fpcalc_result.fingerprint, fpcalc_result.duration as u32))
}

pub fn process_audio_fingerprint<P: AsRef<Path>>(
    path: P,
    tracking_id: String,
) -> ProcessedAudioFingerprint {
    log::info!(
        "process_audio_fingerprint called for path: {:?}, tracking_id: {}",
        path.as_ref(),
        tracking_id
    );

    match inner_process_audio_fingerprint(path) {
        Ok((fingerprint, duration)) => {
            log::info!(
                "Fingerprint processed successfully - duration: {}s, fingerprint length: {}",
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
