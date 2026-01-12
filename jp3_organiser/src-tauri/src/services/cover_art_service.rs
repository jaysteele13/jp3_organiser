//! Cover Art Service for fetching album artwork from Cover Art Archive.
//!
//! Uses the Cover Art Archive API (coverartarchive.org) to fetch album covers
//! based on MusicBrainz Release IDs (MBIDs).
//!
//! # Rate Limiting
//! Cover Art Archive recommends being "polite" with requests (1 req/sec).
//! Images can be cached indefinitely as they're under CC/public domain licenses.

use std::path::Path;
use std::time::Duration;

use serde::Deserialize;
use tokio::time::sleep;

/// Delay between API calls to be polite to Cover Art Archive
const API_CALL_DELAY_MS: u64 = 500;

/// Cover Art Archive API response structures
#[derive(Debug, Deserialize)]
pub struct CoverArtResponse {
    pub images: Vec<CoverArtImage>,
    #[allow(dead_code)]
    pub release: String,
}

#[derive(Debug, Deserialize)]
pub struct CoverArtImage {
    pub front: bool,
    #[allow(dead_code)]
    pub back: bool,
    pub thumbnails: CoverArtThumbnails,
    #[allow(dead_code)]
    pub image: String,
}

#[derive(Debug, Deserialize)]
pub struct CoverArtThumbnails {
    #[serde(rename = "500")]
    pub size_500: Option<String>,
    #[serde(rename = "250")]
    pub size_250: Option<String>,
    #[serde(rename = "1200")]
    pub size_1200: Option<String>,
    pub large: Option<String>,
    pub small: Option<String>,
}

/// Errors that can occur during cover art operations
#[derive(Debug)]
pub enum CoverArtError {
    /// Network or request error
    RequestError(String),
    /// No cover art found for this release
    NotFound,
    /// Failed to parse response
    ParseError(String),
    /// Failed to save image
    IoError(String),
}

impl std::fmt::Display for CoverArtError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CoverArtError::RequestError(msg) => write!(f, "Request failed: {}", msg),
            CoverArtError::NotFound => write!(f, "No cover art found"),
            CoverArtError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            CoverArtError::IoError(msg) => write!(f, "IO error: {}", msg),
        }
    }
}

impl std::error::Error for CoverArtError {}

/// Result of a cover art fetch operation
#[derive(Debug)]
pub struct FetchCoverResult {
    /// Path where the cover was saved
    pub path: String,
    /// Size of the downloaded image in bytes
    pub size_bytes: u64,
}

/// Fetch cover art for a release and save it to the covers directory.
///
/// # Arguments
/// * `mbid` - MusicBrainz Release ID
/// * `covers_dir` - Directory to save covers (e.g., `{library}/jp3/covers`)
/// * `album_id` - Album ID to use for the filename
///
/// # Returns
/// * `Ok(FetchCoverResult)` - Path and size of saved cover
/// * `Err(CoverArtError)` - If fetch or save fails
pub async fn fetch_and_save_cover(
    mbid: &str,
    covers_dir: &Path,
    album_id: u32,
) -> Result<FetchCoverResult, CoverArtError> {
    log::info!("[CoverArt] ========================================");
    log::info!("[CoverArt] fetch_and_save_cover called");
    log::info!("[CoverArt] MBID: {}", mbid);
    log::info!("[CoverArt] Album ID: {}", album_id);
    log::info!("[CoverArt] Covers dir: {:?}", covers_dir);

    // Rate limit
    sleep(Duration::from_millis(API_CALL_DELAY_MS)).await;

    // Fetch cover art metadata from Cover Art Archive
    log::info!("[CoverArt] Step 1: Getting cover URL from API...");
    let cover_url = get_cover_url(mbid).await?;
    log::info!("[CoverArt] Step 1 complete: Got URL: {}", cover_url);

    // Download the image
    log::info!("[CoverArt] Step 2: Downloading image...");
    let image_bytes = download_image(&cover_url).await?;
    log::info!("[CoverArt] Step 2 complete: Downloaded {} bytes", image_bytes.len());

    // Save to file
    log::info!("[CoverArt] Step 3: Saving to disk...");
    let cover_path = covers_dir.join(format!("{}.jpg", album_id));
    log::info!("[CoverArt] Saving to: {:?}", cover_path);
    
    std::fs::write(&cover_path, &image_bytes).map_err(|e| {
        log::error!("[CoverArt] Failed to save cover art: {}", e);
        CoverArtError::IoError(e.to_string())
    })?;

    let size = image_bytes.len() as u64;
    let path_str = cover_path.to_string_lossy().to_string();

    log::info!("[CoverArt] Step 3 complete: Saved {} bytes to {}", size, path_str);
    log::info!("[CoverArt] ========================================");

    Ok(FetchCoverResult {
        path: path_str,
        size_bytes: size,
    })
}

/// Get the best thumbnail URL from Cover Art Archive.
/// Prefers 500px, falls back to 250px, then large, then small.
async fn get_cover_url(mbid: &str) -> Result<String, CoverArtError> {
    let api_url = format!("https://coverartarchive.org/release/{}", mbid);
    log::info!("[CoverArt] Fetching cover art metadata from: {}", api_url);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(10)) // Follow up to 10 redirects
        .build()
        .map_err(|e| CoverArtError::RequestError(e.to_string()))?;

    let response = client
        .get(&api_url)
        .header("User-Agent", "JP3Organiser/1.0 (contact@example.com)")
        .send()
        .await
        .map_err(|e| {
            log::error!("[CoverArt] Failed to fetch cover art metadata: {}", e);
            CoverArtError::RequestError(e.to_string())
        })?;

    log::info!("[CoverArt] Response status: {}", response.status());

    // Handle 404 - no cover art available
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        log::info!("[CoverArt] No cover art found for MBID: {}", mbid);
        return Err(CoverArtError::NotFound);
    }

    if !response.status().is_success() {
        let status = response.status();
        log::error!("[CoverArt] Cover Art Archive returned status: {}", status);
        return Err(CoverArtError::RequestError(format!("HTTP {}", status)));
    }

    let body_text = response.text().await.map_err(|e| {
        log::error!("[CoverArt] Failed to read response body: {}", e);
        CoverArtError::RequestError(e.to_string())
    })?;
    
    log::info!("[CoverArt] Response body length: {} bytes", body_text.len());
    log::info!("[CoverArt] Response body preview: {}", &body_text.chars().take(200).collect::<String>());

    let cover_data: CoverArtResponse = serde_json::from_str(&body_text).map_err(|e| {
        log::error!("[CoverArt] Failed to parse cover art response: {}", e);
        log::error!("[CoverArt] Body was: {}", body_text);
        CoverArtError::ParseError(e.to_string())
    })?;

    log::info!("[CoverArt] Parsed {} images from response", cover_data.images.len());

    // Find the front cover image
    let front_image = cover_data
        .images
        .iter()
        .find(|img| img.front)
        .or_else(|| cover_data.images.first())
        .ok_or(CoverArtError::NotFound)?;

    log::info!("[CoverArt] Found front image, checking thumbnails...");
    log::info!("[CoverArt] Thumbnails - 500: {:?}, 250: {:?}, large: {:?}, small: {:?}", 
        front_image.thumbnails.size_500,
        front_image.thumbnails.size_250,
        front_image.thumbnails.large,
        front_image.thumbnails.small
    );

    // Get the best available thumbnail (prefer 500, then 250, then large, then small)
    let thumbnail_url = front_image
        .thumbnails
        .size_500
        .as_ref()
        .or(front_image.thumbnails.size_250.as_ref())
        .or(front_image.thumbnails.large.as_ref())
        .or(front_image.thumbnails.small.as_ref())
        .ok_or(CoverArtError::NotFound)?;

    log::info!("[CoverArt] Selected thumbnail URL: {}", thumbnail_url);
    Ok(thumbnail_url.clone())
}

/// Download image bytes from a URL.
async fn download_image(url: &str) -> Result<Vec<u8>, CoverArtError> {
    log::info!("[CoverArt] Downloading image from: {}", url);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::limited(10)) // Follow redirects
        .build()
        .map_err(|e| CoverArtError::RequestError(e.to_string()))?;

    let response = client
        .get(url)
        .header("User-Agent", "JP3Organiser/1.0 (contact@example.com)")
        .send()
        .await
        .map_err(|e| {
            log::error!("[CoverArt] Failed to download image: {}", e);
            CoverArtError::RequestError(e.to_string())
        })?;

    log::info!("[CoverArt] Download response status: {}", response.status());

    if !response.status().is_success() {
        log::error!("[CoverArt] Download failed with status: {}", response.status());
        return Err(CoverArtError::RequestError(format!(
            "HTTP {}",
            response.status()
        )));
    }

    let bytes = response.bytes().await.map_err(|e| {
        log::error!("[CoverArt] Failed to read image bytes: {}", e);
        CoverArtError::RequestError(e.to_string())
    })?;

    log::info!("[CoverArt] Downloaded {} bytes successfully", bytes.len());
    Ok(bytes.to_vec())
}

/// Check if a cover already exists for an album.
pub fn cover_exists(covers_dir: &Path, album_id: u32) -> bool {
    let cover_path = covers_dir.join(format!("{}.jpg", album_id));
    cover_path.exists()
}

/// Get the path to a cover if it exists.
pub fn get_cover_path(covers_dir: &Path, album_id: u32) -> Option<String> {
    let cover_path = covers_dir.join(format!("{}.jpg", album_id));
    if cover_path.exists() {
        Some(cover_path.to_string_lossy().to_string())
    } else {
        None
    }
}
