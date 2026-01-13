//! MusicBrainz API Service for searching releases and artists.
//!
//! Uses the MusicBrainz API (musicbrainz.org/ws/2) to search for release MBIDs
//! based on artist and album names. This provides more accurate album cover art
//! than relying solely on AcoustID fingerprinting.
//!
//! # Rate Limiting
//! MusicBrainz enforces strict rate limiting: max 1 request per second per IP.
//! Exceeding this will result in ALL requests being blocked (503 errors).
//! We use a global mutex to ensure compliance across all calls.
//!
//! # User-Agent Requirements
//! MusicBrainz requires a meaningful User-Agent header with contact info.
//! Format: "AppName/Version (contact-url-or-email)"

use std::sync::Mutex;
use std::time::{Duration, Instant};

use once_cell::sync::Lazy;
use serde::Deserialize;

/// Minimum delay between API calls (1 second as per MusicBrainz rate limit)
const MIN_REQUEST_INTERVAL_MS: u64 = 1100; // 1.1 seconds for safety margin

/// Request timeout
const REQUEST_TIMEOUT_SECS: u64 = 30;

/// User-Agent string for MusicBrainz API requests
const USER_AGENT: &str = "JP3Organiser/1.0.0 (https://github.com/jp3-organiser)";

/// Global rate limiter - tracks last request time
static LAST_REQUEST_TIME: Lazy<Mutex<Option<Instant>>> = Lazy::new(|| Mutex::new(None));

/// MusicBrainz API response structures
#[derive(Debug, Deserialize)]
pub struct MusicBrainzSearchResponse {
    pub releases: Option<Vec<MusicBrainzRelease>>,
    pub count: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct MusicBrainzRelease {
    pub id: String,
    pub title: String,
    pub score: Option<u32>,
    #[serde(rename = "artist-credit")]
    pub artist_credit: Option<Vec<ArtistCredit>>,
    pub date: Option<String>,
    #[serde(rename = "release-group")]
    pub release_group: Option<ReleaseGroup>,
}

#[derive(Debug, Deserialize)]
pub struct ArtistCredit {
    pub name: Option<String>,
    pub artist: Option<Artist>,
}

#[derive(Debug, Deserialize)]
pub struct Artist {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct ReleaseGroup {
    pub id: String,
    #[serde(rename = "primary-type")]
    pub primary_type: Option<String>,
}

/// Errors that can occur during MusicBrainz operations
#[derive(Debug)]
pub enum MusicBrainzError {
    /// Network or request error
    RequestError(String),
    /// Rate limit exceeded (should not happen with our limiter)
    RateLimitExceeded,
    /// No results found
    NotFound,
    /// Failed to parse response
    ParseError(String),
}

impl std::fmt::Display for MusicBrainzError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MusicBrainzError::RequestError(msg) => write!(f, "Request failed: {}", msg),
            MusicBrainzError::RateLimitExceeded => write!(f, "Rate limit exceeded"),
            MusicBrainzError::NotFound => write!(f, "No results found"),
            MusicBrainzError::ParseError(msg) => write!(f, "Parse error: {}", msg),
        }
    }
}

impl std::error::Error for MusicBrainzError {}

/// Result of a release search
#[derive(Debug, Clone)]
pub struct ReleaseSearchResult {
    /// MusicBrainz Release ID (MBID)
    pub release_mbid: String,
    /// Release title as returned by MusicBrainz
    pub title: String,
    /// Artist name as returned by MusicBrainz
    pub artist: Option<String>,
    /// Search score (0-100)
    pub score: u32,
    /// Release date if available
    pub date: Option<String>,
}

/// Enforce rate limiting by waiting if necessary.
/// This ensures we never exceed 1 request per second.
async fn enforce_rate_limit() {
    let wait_duration = {
        let last_time = LAST_REQUEST_TIME.lock().unwrap();
        
        if let Some(last) = *last_time {
            let elapsed = last.elapsed();
            let min_interval = Duration::from_millis(MIN_REQUEST_INTERVAL_MS);
            
            if elapsed < min_interval {
                let wait = min_interval - elapsed;
                log::debug!(
                    "[MusicBrainz] Rate limiting: waiting {:?} before next request",
                    wait
                );
                Some(wait)
            } else {
                None
            }
        } else {
            None
        }
    };
    
    // Wait outside the lock to avoid holding it during sleep
    if let Some(wait) = wait_duration {
        tokio::time::sleep(wait).await;
    }
    
    // Update last request time
    let mut last_time = LAST_REQUEST_TIME.lock().unwrap();
    *last_time = Some(Instant::now());
}

/// Build the HTTP client with proper configuration
fn build_client() -> Result<reqwest::Client, MusicBrainzError> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| MusicBrainzError::RequestError(e.to_string()))
}

/// Search for a release MBID by artist and album name.
///
/// This searches the MusicBrainz database using Lucene query syntax.
/// Returns the best matching release MBID for fetching cover art.
///
/// # Arguments
/// * `artist` - Artist name
/// * `album` - Album/release name
///
/// # Returns
/// * `Ok(Some(ReleaseSearchResult))` - Best matching release
/// * `Ok(None)` - No results found
/// * `Err(MusicBrainzError)` - If the search fails
pub async fn search_release(
    artist: &str,
    album: &str,
) -> Result<Option<ReleaseSearchResult>, MusicBrainzError> {
    log::info!(
        "[MusicBrainz] Searching for release - artist: \"{}\", album: \"{}\"",
        artist,
        album
    );

    // Enforce rate limiting
    enforce_rate_limit().await;

    let client = build_client()?;

    // Build Lucene query: artist:"X" AND release:"Y"
    // We escape quotes in the search terms
    let escaped_artist = artist.replace('"', "");
    let escaped_album = album.replace('"', "");
    let query = format!(
        "artist:\"{}\" AND release:\"{}\"",
        escaped_artist, escaped_album
    );

    log::debug!("[MusicBrainz] Query: {}", query);

    let response = client
        .get("https://musicbrainz.org/ws/2/release")
        .query(&[
            ("query", query.as_str()),
            ("fmt", "json"),
            ("limit", "5"),
        ])
        .send()
        .await
        .map_err(|e| {
            log::error!("[MusicBrainz] Request failed: {}", e);
            MusicBrainzError::RequestError(e.to_string())
        })?;

    let status = response.status();
    log::info!("[MusicBrainz] Response status: {}", status);

    // Handle rate limiting (503)
    if status == reqwest::StatusCode::SERVICE_UNAVAILABLE {
        log::error!("[MusicBrainz] Rate limit exceeded (503)");
        return Err(MusicBrainzError::RateLimitExceeded);
    }

    if !status.is_success() {
        log::error!("[MusicBrainz] Request failed with status: {}", status);
        return Err(MusicBrainzError::RequestError(format!("HTTP {}", status)));
    }

    let body = response.text().await.map_err(|e| {
        log::error!("[MusicBrainz] Failed to read response body: {}", e);
        MusicBrainzError::RequestError(e.to_string())
    })?;

    log::debug!(
        "[MusicBrainz] Response body preview: {}",
        &body.chars().take(500).collect::<String>()
    );

    let search_response: MusicBrainzSearchResponse =
        serde_json::from_str(&body).map_err(|e| {
            log::error!("[MusicBrainz] Failed to parse response: {}", e);
            MusicBrainzError::ParseError(e.to_string())
        })?;

    let releases = match search_response.releases {
        Some(releases) if !releases.is_empty() => releases,
        _ => {
            log::info!("[MusicBrainz] No releases found for query");
            return Ok(None);
        }
    };

    log::info!("[MusicBrainz] Found {} releases", releases.len());

    // Get the first (best) result
    let best = &releases[0];
    let artist_name = best
        .artist_credit
        .as_ref()
        .and_then(|ac| ac.first())
        .and_then(|c| c.artist.as_ref().map(|a| a.name.clone()));

    let result = ReleaseSearchResult {
        release_mbid: best.id.clone(),
        title: best.title.clone(),
        artist: artist_name,
        score: best.score.unwrap_or(0),
        date: best.date.clone(),
    };

    log::info!(
        "[MusicBrainz] Best match: \"{}\" by {:?} (score: {}, MBID: {})",
        result.title,
        result.artist,
        result.score,
        result.release_mbid
    );

    Ok(Some(result))
}

/// Search for multiple releases in batch, respecting rate limits.
///
/// Processes each search sequentially with proper rate limiting.
/// Returns results in the same order as input.
///
/// # Arguments
/// * `queries` - List of (artist, album) tuples to search
///
/// # Returns
/// * Vector of Optional results (None if not found, Some if found)
pub async fn search_releases_batch(
    queries: &[(String, String)],
) -> Vec<Option<ReleaseSearchResult>> {
    log::info!(
        "[MusicBrainz] Batch searching {} releases",
        queries.len()
    );

    let mut results = Vec::with_capacity(queries.len());

    for (artist, album) in queries {
        match search_release(artist, album).await {
            Ok(result) => results.push(result),
            Err(e) => {
                log::warn!(
                    "[MusicBrainz] Search failed for \"{}\" - \"{}\": {}",
                    artist,
                    album,
                    e
                );
                results.push(None);
            }
        }
    }

    log::info!(
        "[MusicBrainz] Batch complete: {} found, {} not found",
        results.iter().filter(|r| r.is_some()).count(),
        results.iter().filter(|r| r.is_none()).count()
    );

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_agent_format() {
        // User-Agent should follow MusicBrainz format requirements
        assert!(USER_AGENT.contains("JP3Organiser"));
        assert!(USER_AGENT.contains("/"));
        assert!(USER_AGENT.contains("("));
        assert!(USER_AGENT.contains(")"));
    }

    #[test]
    fn test_rate_limit_constant() {
        // Should be at least 1 second
        assert!(MIN_REQUEST_INTERVAL_MS >= 1000);
    }
}
