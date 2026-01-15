//! Cover Art Service for fetching album and artist artwork.
//!
//! Album covers are fetched from Cover Art Archive (coverartarchive.org) using 
//! MusicBrainz Release IDs (MBIDs).
//!
//! Artist covers are fetched from Fanart.tv using MusicBrainz Artist IDs.
//!
//! # Cover File Naming
//! Cover files are named using a hash of "artist|||album" (normalized to lowercase).
//! For artists, we use "artist|||artist" as the key.
//! This provides stable filenames that don't change when IDs are renumbered
//! during library compaction.
//!
//! # Rate Limiting
//! Cover Art Archive recommends being "polite" with requests (1 req/sec).
//! Images can be cached indefinitely as they're under CC/public domain licenses.

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::time::Duration;
use std::env::var;

use serde::Deserialize;
use tokio::time::sleep;

/// Delay between API calls to be polite to Cover Art Archive
const API_CALL_DELAY_MS: u64 = 500;

/// Cover Art Archive API response structures
#[derive(Debug, Deserialize)]
pub struct CoverArtAlbumResponse {
    pub images: Vec<CoverArtImage>,
    #[allow(dead_code)]
    pub release: String,
}


/// Fanart.tv artist thumbnail response
/// Note: We only need the URL, other fields are ignored.
/// Fanart.tv returns likes/width/height as strings, not numbers.
#[derive(Debug, Deserialize)]
pub struct ArtistThumb {
    pub url: String,
    // Other fields (likes, width, height) are strings in the API response
    // We don't need them, so we skip them entirely
}

/// Fanart.tv API response structure
/// Note: The API returns many fields, we only parse what we need.
#[derive(Debug, Deserialize)]
pub struct FanartResponse {
    #[serde(default)]
    pub artistthumb: Vec<ArtistThumb>,
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

/// Separator used between artist and album in the hash key
const KEY_SEPARATOR: &str = "|||";

/// Generate a stable hash-based filename for a cover image.
///
/// Uses artist + album name (normalized to lowercase) to create a deterministic
/// filename that won't change when album IDs are renumbered during compaction.
///
/// # Arguments
/// * `artist` - Artist name
/// * `album` - Album name
///
/// # Returns
/// A hex string hash (e.g., "a1b2c3d4e5f6")
pub fn cover_filename(artist: &str, album: &str) -> String {
    let normalized_artist = artist.to_lowercase().trim().to_string();
    let normalized_album = album.to_lowercase().trim().to_string();
    let key = format!("{}{}{}", normalized_artist, KEY_SEPARATOR, normalized_album);

    let mut hasher = DefaultHasher::new();
    key.hash(&mut hasher);
    let hash = hasher.finish();

    // Use hex encoding for a clean filename (no special chars)
    format!("{:016x}", hash)
}

/// Fetch cover art for a release and save it to the covers directory.
///
/// # Arguments
/// * `mbid` - MusicBrainz Release ID
/// * `covers_dir` - Directory to save covers (e.g., `{library}/jp3/assets/albums`)
/// * `artist` - Artist name (for generating stable filename)
/// * `album` - Album name (for generating stable filename)
///
/// # Returns
/// * `Ok(FetchCoverResult)` - Path and size of saved cover
/// * `Err(CoverArtError)` - If fetch or save fails
pub async fn fetch_and_save_album_cover(
    mbid: &str,
    covers_dir: &Path,
    artist: &str,
    album: &str,
) -> Result<FetchCoverResult, CoverArtError> {
    let filename = cover_filename(artist, album);
    
    log::info!("[CoverArt] ========================================");
    log::info!("[CoverArt] fetch_and_save_album_cover called");
    log::info!("[CoverArt] MBID: {}", mbid);
    log::info!("[CoverArt] Artist: {}, Album: {}", artist, album);
    log::info!("[CoverArt] Generated filename: {}", filename);
    log::info!("[CoverArt] Covers dir: {:?}", covers_dir);

    // Rate limit
    sleep(Duration::from_millis(API_CALL_DELAY_MS)).await;

    // Fetch cover art metadata from Cover Art Archive
    log::info!("[CoverArt] Step 1: Getting cover URL from API...");
    let cover_url = get_album_cover_url(mbid).await?;
    log::info!("[CoverArt] Step 1 complete: Got URL: {}", cover_url);

    // Download and save the image
    save_cover_image(&cover_url, covers_dir, &filename).await
}

/// Fetch artist cover art from Fanart.tv and save it to the covers directory.
///
/// # Arguments
/// * `artist_mbid` - MusicBrainz Artist ID
/// * `covers_dir` - Directory to save covers (e.g., `{library}/jp3/assets/artists`)
/// * `artist` - Artist name (for generating stable filename)
///
/// # Returns
/// * `Ok(FetchCoverResult)` - Path and size of saved cover
/// * `Err(CoverArtError)` - If fetch or save fails
pub async fn fetch_and_save_artist_cover(
    artist_mbid: &str,
    covers_dir: &Path,
    artist: &str,
) -> Result<FetchCoverResult, CoverArtError> {
    // Use "artist" as the second component for artist covers
    let filename = cover_filename(artist, "artist");
    
    log::info!("[FanArt] ========================================");
    log::info!("[FanArt] fetch_and_save_artist_cover called");
    log::info!("[FanArt] Artist MBID: {}", artist_mbid);
    log::info!("[FanArt] Artist: {}", artist);
    log::info!("[FanArt] Generated filename: {}", filename);
    log::info!("[FanArt] Covers dir: {:?}", covers_dir);

    // Rate limit
    sleep(Duration::from_millis(API_CALL_DELAY_MS)).await;

    // Fetch artist cover URL from Fanart.tv
    log::info!("[FanArt] Step 1: Getting artist cover URL from Fanart.tv API...");
    let cover_url = get_artist_cover_url(artist_mbid).await?;
    log::info!("[FanArt] Step 1 complete: Got URL: {}", cover_url);

    // Download and save the image
    save_cover_image(&cover_url, covers_dir, &filename).await
}

/// Download and save a cover image to disk.
async fn save_cover_image(
    cover_url: &str,
    covers_dir: &Path,
    filename: &str,
) -> Result<FetchCoverResult, CoverArtError> {
    // Download the image
    log::info!("[CoverArt] Step 2: Downloading image...");
    let image_bytes = download_image(cover_url).await?;
    log::info!("[CoverArt] Step 2 complete: Downloaded {} bytes", image_bytes.len());

    // Save to file
    log::info!("[CoverArt] Step 3: Saving to disk...");
    let cover_path = covers_dir.join(format!("{}.jpg", filename));
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
async fn get_album_cover_url(mbid: &str) -> Result<String, CoverArtError> {
    let api_url = format!("https://coverartarchive.org/release/{}", mbid);
    log::info!("[CoverArt] Fetching cover art metadata from: {}", api_url);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(10)) // Follow up to 10 redirects
        .build()
        .map_err(|e| CoverArtError::RequestError(e.to_string()))?;

    let response = client
        .get(&api_url)
        .header("User-Agent", "JP3Organiser/1.0")
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

    let cover_data: CoverArtAlbumResponse = serde_json::from_str(&body_text).map_err(|e| {
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


async fn get_artist_cover_url(mbid: &str) -> Result<String, CoverArtError> {

    // Load in the API key from .env.local
    let api_key = var("FANART_PROJECT_KEY").map_err(|e| {
        log::error!("FANART_PROJECT_KEY environment variable not set: {}", e);
        CoverArtError::ParseError("FANART_PROJECT_KEY not set".to_string())
    })?;



    let api_url = format!("https://webservice.fanart.tv/v3.2/music/{}?api_key={}", mbid, api_key );
    log::info!("[CoverArt] Fetching cover art metadata from: {}", api_url);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(10)) // Follow up to 10 redirects
        .build()
        .map_err(|e| CoverArtError::RequestError(e.to_string()))?;

    let response = client
        .get(&api_url)
        .header("User-Agent", "JP3Organiser/1.0")
        .send()
        .await
        .map_err(|e| {
            log::error!("[CoverArt] Failed to fetch cover art metadata: {}", e);
            CoverArtError::RequestError(e.to_string())
        })?;

    log::info!("[CoverArt] Response status: {}", response.status());

    // We must parse the resonse. In this response we will want to grab the artistthumb array in which we will grab the image with the most ikes.
    // We can grab the firstone from the array as it seems the response is ordered by likes.

    //so will be artistthumb[0].url

    // we will need a new struct for this response and will return the url. 

    // Handle 404 - no cover art available
    if response.status() == reqwest::StatusCode::NOT_FOUND {
        log::info!("[CoverArt] No cover art found for MBID: {}", mbid);
        return Err(CoverArtError::NotFound);
    }

    if !response.status().is_success() {
        let status = response.status();
        log::error!("[FanArt] fanart tv returned status: {}", status);
        return Err(CoverArtError::RequestError(format!("HTTP {}", status)));
    }

    let body_text = response.text().await.map_err(|e| {
        log::error!("[FanArt] Failed to read response body: {}", e);
        CoverArtError::RequestError(e.to_string())
    })?;
    
    log::info!("[FanArt] Response body length: {} bytes", body_text.len());
    log::info!("[FanArt] Response body preview: {}", &body_text.chars().take(200).collect::<String>());

    let cover_data: FanartResponse = serde_json::from_str(&body_text).map_err(|e| {
        log::error!("[FanArt] Failed to parse cover art response: {}", e);
        log::error!("[FanArt] Body was: {}", body_text);
        CoverArtError::ParseError(e.to_string())
    })?;


    // there is no option for image sizes just whatever it gives us we take the first one.
    let thumbnail_url = cover_data.artistthumb
        .first()
        .map(|img| img.url.clone())
        .ok_or_else(|| {
            log::error!("[FanArt] No artist thumbnail found in response for MBID: {}", mbid);
            CoverArtError::NotFound
        })?;

    log::info!("[FanArt] Selected thumbnail URL: {}", thumbnail_url);
    Ok(thumbnail_url)
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

/// Check if a cover already exists for an album (by artist+album name).
pub fn cover_exists_by_name(covers_dir: &Path, artist: &str, album: &str) -> bool {
    let filename = cover_filename(artist, album);
    let cover_path = covers_dir.join(format!("{}.jpg", filename));
    cover_path.exists()
}

/// Get the path to a cover if it exists (by artist+album name).
pub fn get_cover_path_by_name(covers_dir: &Path, artist: &str, album: &str) -> Option<String> {
    let filename = cover_filename(artist, album);
    let cover_path = covers_dir.join(format!("{}.jpg", filename));
    if cover_path.exists() {
        Some(cover_path.to_string_lossy().to_string())
    } else {
        None
    }
}


