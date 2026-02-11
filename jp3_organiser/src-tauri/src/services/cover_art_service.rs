//! Cover Art Service for fetching album and artist artwork.
//!
//! Album covers are fetched from Cover Art Archive (coverartarchive.org) using 
//! MusicBrainz Release IDs (MBIDs).
//!
//! Artist covers are fetched from Deezer API (api.deezer.com) by searching
//! the artist name. No API key required.
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


/// Deezer artist search result
/// Represents a single artist from the Deezer search API response.
/// We only need the picture URLs, other fields are ignored.
#[derive(Debug, Deserialize)]
pub struct DeezerArtist {
    pub name: String,
    /// 500x500 artist picture
    pub picture_big: Option<String>,
    /// 250x250 artist picture
    pub picture_medium: Option<String>,
    /// 1000x1000 artist picture
    pub picture_xl: Option<String>,
}

/// Deezer search API response structure
/// GET https://api.deezer.com/search/artist/?q=ARTIST_NAME
#[derive(Debug, Deserialize)]
pub struct DeezerSearchResponse {
    #[serde(default)]
    pub data: Vec<DeezerArtist>,
}

/// Deezer album search result item
/// Represents a single track result from the Deezer search API.
/// We extract the nested album.cover_big URL.
#[derive(Debug, Deserialize)]
pub struct DeezerAlbumSearchItem {
    pub album: DeezerAlbumInfo,
}

/// Nested album info within a Deezer search result
#[derive(Debug, Deserialize)]
pub struct DeezerAlbumInfo {
    pub cover_big: Option<String>,
    pub cover_medium: Option<String>,
    pub cover_xl: Option<String>,
}

/// Deezer album search API response structure
/// GET https://api.deezer.com/search?q=artist:"NAME"album:"ALBUM"
#[derive(Debug, Deserialize)]
pub struct DeezerAlbumSearchResponse {
    #[serde(default)]
    pub data: Vec<DeezerAlbumSearchItem>,
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
/// Tries the primary MBID first. If Cover Art Archive returns 404 (NotFound)
/// and a fallback MBID is provided, retries with the fallback before giving up.
///
/// # Arguments
/// * `mbid` - Primary MusicBrainz Release ID (typically from MusicBrainz search)
/// * `fallback_mbid` - Optional fallback Release ID (typically from AcoustID fingerprinting)
/// * `covers_dir` - Directory to save covers (e.g., `{library}/jp3/assets/albums`)
/// * `artist` - Artist name (for generating stable filename)
/// * `album` - Album name (for generating stable filename)
///
/// # Returns
/// * `Ok(FetchCoverResult)` - Path and size of saved cover
/// * `Err(CoverArtError)` - If fetch or save fails for all MBIDs
pub async fn fetch_and_save_album_cover(
    mbid: &str,
    fallback_mbid: Option<&str>,
    covers_dir: &Path,
    artist: &str,
    album: &str,
) -> Result<FetchCoverResult, CoverArtError> {
    let filename = cover_filename(artist, album);
    
    log::info!("[CoverArt] ========================================");
    log::info!("[CoverArt] fetch_and_save_album_cover called");
    log::info!("[CoverArt] Primary MBID: {}", mbid);
    log::info!("[CoverArt] Fallback MBID: {:?}", fallback_mbid);
    log::info!("[CoverArt] Artist: {}, Album: {}", artist, album);
    log::info!("[CoverArt] Generated filename: {}", filename);
    log::info!("[CoverArt] Covers dir: {:?}", covers_dir);

    // Rate limit
    sleep(Duration::from_millis(API_CALL_DELAY_MS)).await;

    // Fetch cover art metadata from Cover Art Archive (primary MBID)
    log::info!("[CoverArt] Step 1: Getting cover URL from API (primary MBID)...");
    let cover_url = match get_album_cover_url(mbid).await {
        Ok(url) => {
            log::info!("[CoverArt] Step 1 complete: Got URL from primary MBID: {}", url);
            url
        }
        Err(CoverArtError::NotFound) => {
            // Primary MBID has no cover art — try fallback if available
            match fallback_mbid {
                Some(fallback) if fallback != mbid => {
                    log::info!(
                        "[CoverArt] Primary MBID {} returned NotFound, trying fallback MBID: {}",
                        mbid, fallback
                    );
                    // Rate limit before retry
                    sleep(Duration::from_millis(API_CALL_DELAY_MS)).await;
                    let url = get_album_cover_url(fallback).await?;
                    log::info!("[CoverArt] Step 1 complete: Got URL from fallback MBID: {}", url);
                    url
                }
                _ => {
                    log::info!("[CoverArt] No fallback MBID available, returning NotFound");
                    return Err(CoverArtError::NotFound);
                }
            }
        }
        Err(e) => return Err(e),
    };

    // Download and save the image
    save_cover_image(&cover_url, covers_dir, &filename).await
}

/// Fetch artist cover art from Deezer and save it to the covers directory.
///
/// Searches Deezer by artist name — no MBID or API key required.
///
/// # Arguments
/// * `covers_dir` - Directory to save covers (e.g., `{library}/jp3/assets/artists`)
/// * `artist` - Artist name (used for search and for generating stable filename)
///
/// # Returns
/// * `Ok(FetchCoverResult)` - Path and size of saved cover
/// * `Err(CoverArtError)` - If fetch or save fails
pub async fn fetch_and_save_artist_cover(
    covers_dir: &Path,
    artist: &str,
) -> Result<FetchCoverResult, CoverArtError> {
    // Use "artist" as the second component for artist covers
    let filename = cover_filename(artist, "artist");
    
    log::info!("[Deezer] ========================================");
    log::info!("[Deezer] fetch_and_save_artist_cover called");
    log::info!("[Deezer] Artist: {}", artist);
    log::info!("[Deezer] Generated filename: {}", filename);
    log::info!("[Deezer] Covers dir: {:?}", covers_dir);

    // Rate limit
    sleep(Duration::from_millis(API_CALL_DELAY_MS)).await;

    // Fetch artist cover URL from Deezer
    log::info!("[Deezer] Step 1: Getting artist cover URL from Deezer API...");
    let cover_url = get_artist_cover_url(artist).await?;
    log::info!("[Deezer] Step 1 complete: Got URL: {}", cover_url);

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


/// Search Deezer for an artist by name and return the best picture URL.
/// Prefers picture_big (500x500), falls back to picture_xl, then picture_medium.
/// No API key required.
async fn get_artist_cover_url(artist_name: &str) -> Result<String, CoverArtError> {
    let encoded_name = urlencoding::encode(artist_name);
    let api_url = format!("https://api.deezer.com/search/artist/?q={}", encoded_name);
    log::info!("[Deezer] Fetching artist image from: {}", api_url);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| CoverArtError::RequestError(e.to_string()))?;

    let response = client
        .get(&api_url)
        .header("User-Agent", "JP3Organiser/1.0")
        .send()
        .await
        .map_err(|e| {
            log::error!("[Deezer] Failed to fetch artist image: {}", e);
            CoverArtError::RequestError(e.to_string())
        })?;

    log::info!("[Deezer] Response status: {}", response.status());

    if !response.status().is_success() {
        let status = response.status();
        log::error!("[Deezer] Deezer returned status: {}", status);
        return Err(CoverArtError::RequestError(format!("HTTP {}", status)));
    }

    let body_text = response.text().await.map_err(|e| {
        log::error!("[Deezer] Failed to read response body: {}", e);
        CoverArtError::RequestError(e.to_string())
    })?;

    log::info!("[Deezer] Response body length: {} bytes", body_text.len());
    log::info!("[Deezer] Response body preview: {}", &body_text.chars().take(300).collect::<String>());

    let search_result: DeezerSearchResponse = serde_json::from_str(&body_text).map_err(|e| {
        log::error!("[Deezer] Failed to parse search response: {}", e);
        log::error!("[Deezer] Body was: {}", body_text);
        CoverArtError::ParseError(e.to_string())
    })?;

    // Take the first result (best match)
    let artist = search_result.data.first().ok_or_else(|| {
        log::info!("[Deezer] No artist found for: {}", artist_name);
        CoverArtError::NotFound
    })?;

    log::info!("[Deezer] Found artist: {}", artist.name);

    // Prefer picture_big (500x500), then picture_xl (1000x1000), then picture_medium (250x250)
    let thumbnail_url = artist
        .picture_big
        .as_ref()
        .or(artist.picture_xl.as_ref())
        .or(artist.picture_medium.as_ref())
        .ok_or_else(|| {
            log::error!("[Deezer] No picture URLs found for artist: {}", artist_name);
            CoverArtError::NotFound
        })?;

    log::info!("[Deezer] Selected thumbnail URL: {}", thumbnail_url);
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

/// Search Deezer for an album cover by artist and album name.
///
/// Uses the Deezer search API: `https://api.deezer.com/search?q=artist:"NAME"album:"ALBUM"`
/// Returns the first result's `album.cover_big` URL.
/// No API key required.
///
/// This is used as a fallback when CoverArtArchive is unavailable (5xx errors).
pub async fn fetch_and_save_deezer_album_cover(
    covers_dir: &Path,
    artist: &str,
    album: &str,
) -> Result<FetchCoverResult, CoverArtError> {
    let filename = cover_filename(artist, album);

    log::info!("[Deezer] ========================================");
    log::info!("[Deezer] fetch_and_save_deezer_album_cover called");
    log::info!("[Deezer] Artist: {}, Album: {}", artist, album);
    log::info!("[Deezer] Generated filename: {}", filename);

    // Rate limit
    sleep(Duration::from_millis(API_CALL_DELAY_MS)).await;

    // Build Deezer search URL: artist:"NAME"album:"ALBUM"
    let query = format!("artist:\"{}\"album:\"{}\"", artist, album);
    let encoded_query = urlencoding::encode(&query);
    let api_url = format!("https://api.deezer.com/search?q={}", encoded_query);
    log::info!("[Deezer] Fetching album cover from: {}", api_url);

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| CoverArtError::RequestError(e.to_string()))?;

    let response = client
        .get(&api_url)
        .header("User-Agent", "JP3Organiser/1.0")
        .send()
        .await
        .map_err(|e| {
            log::error!("[Deezer] Failed to fetch album cover: {}", e);
            CoverArtError::RequestError(e.to_string())
        })?;

    log::info!("[Deezer] Response status: {}", response.status());

    if !response.status().is_success() {
        let status = response.status();
        log::error!("[Deezer] Deezer returned status: {}", status);
        return Err(CoverArtError::RequestError(format!("HTTP {}", status)));
    }

    let body_text = response.text().await.map_err(|e| {
        log::error!("[Deezer] Failed to read response body: {}", e);
        CoverArtError::RequestError(e.to_string())
    })?;

    log::info!("[Deezer] Response body length: {} bytes", body_text.len());
    log::info!("[Deezer] Response body preview: {}", &body_text.chars().take(300).collect::<String>());

    let search_result: DeezerAlbumSearchResponse = serde_json::from_str(&body_text).map_err(|e| {
        log::error!("[Deezer] Failed to parse album search response: {}", e);
        log::error!("[Deezer] Body was: {}", body_text);
        CoverArtError::ParseError(e.to_string())
    })?;

    // Take the first result
    let item = search_result.data.first().ok_or_else(|| {
        log::info!("[Deezer] No album results found for: {} - {}", artist, album);
        CoverArtError::NotFound
    })?;

    // Prefer cover_big, then cover_xl, then cover_medium
    let cover_url = item.album.cover_big
        .as_ref()
        .or(item.album.cover_xl.as_ref())
        .or(item.album.cover_medium.as_ref())
        .ok_or_else(|| {
            log::error!("[Deezer] No cover URLs found for album: {} - {}", artist, album);
            CoverArtError::NotFound
        })?;

    log::info!("[Deezer] Selected album cover URL: {}", cover_url);

    // Download and save the image
    save_cover_image(cover_url, covers_dir, &filename).await
}


