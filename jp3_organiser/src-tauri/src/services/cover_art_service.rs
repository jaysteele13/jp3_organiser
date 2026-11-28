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
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
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
    
    // Attempt 1: Cover Art Archive (Primary MBID)
    let caa_result = get_album_cover_url(mbid).await;

    // Attempt 2: Cover Art Archive (Fallback MBID) if Primary was NotFound
    let caa_result = match caa_result {
        Err(CoverArtError::NotFound) => {
            if let Some(fallback) = fallback_mbid {
                if fallback != mbid {
                    log::info!(
                        "[CoverArt] Primary MBID {} returned NotFound, trying fallback MBID: {}",
                        mbid, fallback
                    );
                    // Rate limit before retry
                    sleep(Duration::from_millis(API_CALL_DELAY_MS)).await;
                    get_album_cover_url(fallback).await
                } else {
                    Err(CoverArtError::NotFound)
                }
            } else {
                Err(CoverArtError::NotFound)
            }
        }
        other => other,
    };

    // If Cover Art Archive succeeded, save the image
    match caa_result {
        Ok(url) => {
             log::info!("[CoverArt] Step 1 complete: Got URL from Cover Art Archive: {}", url);
             save_cover_image(&url, covers_dir, &filename).await
        },
        Err(e) => {
             // If all CAA attempts failed (or errored), try Deezer fallback
             log::warn!("[CoverArt] Cover Art Archive failed: {}. Attempting Deezer fallback...", e);
             fetch_and_save_deezer_album_cover(covers_dir, artist, album).await
        }
    }
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


// ── Manual cover picker ("Edit Cover Art") ──

/// Most images the picker offers at once.
const MAX_CANDIDATES: usize = 8;

/// Whether a cover belongs to an album, an artist or a playlist.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CoverKind {
    Album,
    Artist,
    Playlist,
}

impl CoverKind {
    pub fn parse(kind: &str) -> Result<Self, String> {
        match kind {
            "album" => Ok(Self::Album),
            "artist" => Ok(Self::Artist),
            "playlist" => Ok(Self::Playlist),
            other => Err(format!("Unknown cover kind: {other}")),
        }
    }

    /// Where this cover is cached: `{library}/jp3/assets/{albums|artists|playlists}/{hash}.jpg`.
    /// Artists are hashed against the literal "artist", like the automatic lookup.
    /// For playlists `artist` is the playlist ID, which stays the same when the playlist is renamed.
    pub fn cover_path(self, library: &Path, artist: &str, album: &str) -> PathBuf {
        let (folder, key) = match self {
            Self::Album => ("albums", album),
            Self::Artist => ("artists", "artist"),
            Self::Playlist => ("playlists", "playlist"),
        };
        library
            .join("jp3")
            .join("assets")
            .join(folder)
            .join(format!("{}.jpg", cover_filename(artist, key)))
    }
}

/// One image the user can pick in the cover picker.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverCandidate {
    /// Full-size image that gets saved as the cover
    pub url: String,
    /// Smaller image shown in the picker grid
    pub thumb_url: String,
    /// Where the image came from, e.g. "Deezer"
    pub source: &'static str,
}

/// Read the array stored under `key` in a JSON body. Empty if missing or malformed.
fn json_array(body: &str, key: &str) -> Vec<Value> {
    serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|json| json.get(key)?.as_array().cloned())
        .unwrap_or_default()
}

/// Deezer names its blank "no picture" image after the MD5 of nothing.
const DEEZER_BLANK_IMAGE: &str = "d41d8cd98f00b204e9800998ecf8427e";

/// Build a candidate from one Deezer search result, unless it has no real image.
fn deezer_candidate(item: &Value, big_key: &str, medium_key: &str) -> Option<CoverCandidate> {
    let url = item.get(big_key)?.as_str()?;
    // A missing image shows up as the blank image or as an empty name ("cover//500x500")
    let has_no_image = url.contains(DEEZER_BLANK_IMAGE) || url.trim_start_matches("https://").contains("//");
    if has_no_image {
        return None;
    }
    Some(CoverCandidate {
        url: url.to_string(),
        thumb_url: item.get(medium_key)?.as_str()?.to_string(),
        source: "Deezer",
    })
}

/// Candidates from `https://api.deezer.com/search/album`.
fn parse_deezer_albums(body: &str) -> Vec<CoverCandidate> {
    json_array(body, "data")
        .iter()
        .filter_map(|album| deezer_candidate(album, "cover_big", "cover_medium"))
        .collect()
}

/// Candidates from `https://api.deezer.com/search/artist`.
/// Deezer also returns related artists, so only exact name matches are kept.
fn parse_deezer_artists(body: &str, artist: &str) -> Vec<CoverCandidate> {
    let wanted = artist.trim().to_lowercase();
    let is_wanted = |found: &&Value| found.get("name").and_then(Value::as_str).map(str::to_lowercase) == Some(wanted.clone());

    json_array(body, "data")
        .iter()
        .filter(is_wanted)
        .filter_map(|found| deezer_candidate(found, "picture_big", "picture_medium"))
        .collect()
}

/// Image fields of a TheAudioDB artist that make a usable cover.
const THEAUDIODB_IMAGE_FIELDS: [&str; 5] =
    ["strArtistThumb", "strArtistFanart", "strArtistFanart2", "strArtistFanart3", "strArtistLogo"];

/// Candidates from `https://www.theaudiodb.com/api/v1/json/123/search.php`.
/// Adding `/small` to an image URL gives a smaller version for the grid.
fn parse_theaudiodb_artist(body: &str) -> Vec<CoverCandidate> {
    json_array(body, "artists")
        .iter()
        .flat_map(|artist| THEAUDIODB_IMAGE_FIELDS.iter().filter_map(|field| artist.get(*field)?.as_str()))
        .map(|url| CoverCandidate {
            url: url.to_string(),
            thumb_url: format!("{url}/small"),
            source: "TheAudioDB",
        })
        .collect()
}

/// Candidates from `https://itunes.apple.com/search?entity=album`.
/// iTunes only lists a 100px image, but the same URL serves any size.
fn parse_itunes_albums(body: &str) -> Vec<CoverCandidate> {
    json_array(body, "results")
        .iter()
        .filter_map(|album| {
            let artwork = album.get("artworkUrl100")?.as_str()?;
            Some(CoverCandidate {
                url: artwork.replace("100x100bb", "600x600bb"),
                thumb_url: artwork.replace("100x100bb", "200x200bb"),
                source: "iTunes",
            })
        })
        .collect()
}

/// Combine each source's results by taking one from each in turn, so every
/// source gets a share of the `MAX_CANDIDATES` slots. Duplicate URLs are dropped.
fn merge_candidates(sources: Vec<Vec<CoverCandidate>>) -> Vec<CoverCandidate> {
    let longest = sources.iter().map(Vec::len).max().unwrap_or(0);
    let mut merged: Vec<CoverCandidate> = Vec::new();

    for index in 0..longest {
        for candidate in sources.iter().filter_map(|source| source.get(index)) {
            let is_new = !merged.iter().any(|kept| kept.url == candidate.url);
            if is_new && merged.len() < MAX_CANDIDATES {
                merged.push(candidate.clone());
            }
        }
    }
    merged
}

/// GET a URL and return the response body as text.
async fn fetch_text(url: &str) -> Result<String, CoverArtError> {
    let request_error = |e: reqwest::Error| CoverArtError::RequestError(e.to_string());

    let response = reqwest::Client::new()
        .get(url)
        .header("User-Agent", "JP3Organiser/1.0")
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(request_error)?;

    if !response.status().is_success() {
        return Err(CoverArtError::RequestError(format!("HTTP {}", response.status())));
    }
    response.text().await.map_err(request_error)
}

/// Fetch one image source and parse it. A source that fails is logged and
/// gives no candidates, so the other sources still show.
async fn fetch_candidates(url: &str, parse: impl Fn(&str) -> Vec<CoverCandidate>) -> Vec<CoverCandidate> {
    match fetch_text(url).await {
        Ok(body) => parse(&body),
        Err(e) => {
            log::warn!("[CoverArt] Candidate search failed for {}: {}", url, e);
            Vec::new()
        }
    }
}

/// Search the free image sources for covers the user can choose from.
pub async fn search_cover_candidates(kind: CoverKind, artist: &str, album: &str) -> Vec<CoverCandidate> {
    let found = match kind {
        CoverKind::Album => {
            let query = urlencoding::encode(&format!("{artist} {album}")).into_owned();
            let deezer = format!("https://api.deezer.com/search/album?q={query}&limit={MAX_CANDIDATES}");
            let itunes = format!("https://itunes.apple.com/search?term={query}&entity=album&limit={MAX_CANDIDATES}");
            vec![
                fetch_candidates(&deezer, parse_deezer_albums).await,
                fetch_candidates(&itunes, parse_itunes_albums).await,
            ]
        }
        CoverKind::Artist => {
            let query = urlencoding::encode(artist);
            let deezer = format!("https://api.deezer.com/search/artist?q={query}&limit={MAX_CANDIDATES}");
            // "123" is TheAudioDB's public free key
            let theaudiodb = format!("https://www.theaudiodb.com/api/v1/json/123/search.php?s={query}");
            vec![
                fetch_candidates(&deezer, |body| parse_deezer_artists(body, artist)).await,
                fetch_candidates(&theaudiodb, parse_theaudiodb_artist).await,
            ]
        }
        // A playlist cover is uploaded by the user, so there is nothing to search for
        CoverKind::Playlist => Vec::new(),
    };
    merge_candidates(found)
}

/// Image hosts a chosen cover may be downloaded from (subdomains included).
const ALLOWED_IMAGE_HOSTS: [&str; 4] = ["dzcdn.net", "mzstatic.com", "theaudiodb.com", "api.dicebear.com"];

/// True for `https` URLs on one of the image hosts the picker offers.
///
/// `set_cover_from_url` downloads whatever URL it is given, so this stops it
/// being used to fetch arbitrary addresses.
pub fn is_allowed_image_url(url: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(url) else {
        return false;
    };
    let host = url.host_str().unwrap_or_default();

    url.scheme() == "https"
        && ALLOWED_IMAGE_HOSTS
            .iter()
            .any(|allowed| host == *allowed || host.ends_with(&format!(".{allowed}")))
}

/// Download a chosen image and save it as the cover, replacing any existing one.
///
/// Note: `download_image` follows redirects, so the allow-list only covers
/// the first address requested.
pub async fn save_cover_from_url(cover_path: &Path, url: &str) -> Result<(), CoverArtError> {
    if !is_allowed_image_url(url) {
        return Err(CoverArtError::RequestError(format!("Image host is not allowed: {url}")));
    }
    write_cover(cover_path, &download_image(url).await?)
}

/// Save image bytes as the cover, creating its folder if needed and replacing any existing cover.
pub fn write_cover(cover_path: &Path, image: &[u8]) -> Result<(), CoverArtError> {
    let io_error = |e: std::io::Error| CoverArtError::IoError(e.to_string());

    if let Some(folder) = cover_path.parent() {
        std::fs::create_dir_all(folder).map_err(io_error)?;
    }
    std::fs::write(cover_path, image).map_err(io_error)
}

/// Delete a cached cover so the placeholder shows again. Fine if it is already gone.
pub fn remove_cover(cover_path: &Path) -> Result<(), CoverArtError> {
    match std::fs::remove_file(cover_path) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(CoverArtError::IoError(e.to_string())),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate(url: &str, source: &'static str) -> CoverCandidate {
        CoverCandidate { url: url.into(), thumb_url: url.into(), source }
    }

    #[test]
    fn deezer_albums_use_big_cover_and_medium_thumb() {
        let body = r#"{"data":[
            {"title":"OK Computer","cover_medium":"https://cdn-images.dzcdn.net/a/250.jpg","cover_big":"https://cdn-images.dzcdn.net/a/500.jpg"},
            {"title":"No art","cover_medium":null,"cover_big":null}
        ]}"#;

        assert_eq!(
            parse_deezer_albums(body),
            vec![CoverCandidate {
                url: "https://cdn-images.dzcdn.net/a/500.jpg".into(),
                thumb_url: "https://cdn-images.dzcdn.net/a/250.jpg".into(),
                source: "Deezer",
            }]
        );
    }

    #[test]
    fn itunes_albums_are_upscaled_from_the_100px_artwork() {
        let body = r#"{"resultCount":1,"results":[
            {"collectionName":"OK Computer","artworkUrl100":"https://is1-ssl.mzstatic.com/x/100x100bb.jpg"}
        ]}"#;

        assert_eq!(
            parse_itunes_albums(body),
            vec![CoverCandidate {
                url: "https://is1-ssl.mzstatic.com/x/600x600bb.jpg".into(),
                thumb_url: "https://is1-ssl.mzstatic.com/x/200x200bb.jpg".into(),
                source: "iTunes",
            }]
        );
    }

    #[test]
    fn deezer_artists_keep_only_the_artist_searched_for() {
        // Deezer's artist search also returns related artists
        let body = r#"{"data":[
            {"name":"Radiohead","picture_medium":"https://cdn-images.dzcdn.net/r/250.jpg","picture_big":"https://cdn-images.dzcdn.net/r/500.jpg"},
            {"name":"Blur","picture_medium":"https://cdn-images.dzcdn.net/b/250.jpg","picture_big":"https://cdn-images.dzcdn.net/b/500.jpg"}
        ]}"#;

        assert_eq!(
            parse_deezer_artists(body, " radiohead "),
            vec![CoverCandidate {
                url: "https://cdn-images.dzcdn.net/r/500.jpg".into(),
                thumb_url: "https://cdn-images.dzcdn.net/r/250.jpg".into(),
                source: "Deezer",
            }]
        );
    }

    #[test]
    fn deezer_entries_without_a_real_image_are_skipped() {
        // Deezer serves a blank image, named after the MD5 of nothing, when it has no picture
        let body = r#"{"data":[
            {"name":"Radiohead","picture_medium":"https://cdn-images.dzcdn.net/images/artist/d41d8cd98f00b204e9800998ecf8427e/250x250.jpg","picture_big":"https://cdn-images.dzcdn.net/images/artist/d41d8cd98f00b204e9800998ecf8427e/500x500.jpg"},
            {"name":"Radiohead","cover_medium":"https://cdn-images.dzcdn.net/images/cover//250x250.jpg","cover_big":"https://cdn-images.dzcdn.net/images/cover//500x500.jpg"}
        ]}"#;

        assert!(parse_deezer_artists(body, "Radiohead").is_empty());
        assert!(parse_deezer_albums(body).is_empty());
    }

    #[test]
    fn theaudiodb_artist_lists_each_image_it_has() {
        let body = r#"{"artists":[{
            "strArtist":"Radiohead",
            "strArtistThumb":"https://r2.theaudiodb.com/thumb.jpg",
            "strArtistFanart":"https://r2.theaudiodb.com/fanart.jpg",
            "strArtistFanart2":null,
            "strArtistLogo":"https://r2.theaudiodb.com/logo.png"
        }]}"#;

        let urls: Vec<String> = parse_theaudiodb_artist(body).into_iter().map(|c| c.url).collect();

        assert_eq!(
            urls,
            ["https://r2.theaudiodb.com/thumb.jpg", "https://r2.theaudiodb.com/fanart.jpg", "https://r2.theaudiodb.com/logo.png"]
        );
    }

    #[test]
    fn theaudiodb_reports_no_artist_as_null() {
        assert!(parse_theaudiodb_artist(r#"{"artists":null}"#).is_empty());
    }

    #[test]
    fn cover_kind_is_album_or_artist_only() {
        assert_eq!(CoverKind::parse("album"), Ok(CoverKind::Album));
        assert_eq!(CoverKind::parse("artist"), Ok(CoverKind::Artist));
        assert_eq!(CoverKind::parse("playlist"), Ok(CoverKind::Playlist));
        assert!(CoverKind::parse("song").is_err());
    }

    #[test]
    fn malformed_or_empty_bodies_give_no_candidates() {
        for body in ["", "not json", "{}", r#"{"data":"oops"}"#] {
            assert!(parse_deezer_albums(body).is_empty(), "deezer: {body}");
            assert!(parse_itunes_albums(body).is_empty(), "itunes: {body}");
        }
    }

    #[test]
    fn allows_https_images_from_the_known_hosts() {
        for url in [
            "https://cdn-images.dzcdn.net/images/cover/abc/500x500.jpg",
            "https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg",
            "https://r2.theaudiodb.com/images/media/artist/thumb/x.jpg",
            "https://api.dicebear.com/9.x/pixel-art/jpg?seed=radiohead",
        ] {
            assert!(is_allowed_image_url(url), "{url}");
        }
    }

    #[test]
    fn rejects_other_hosts_lookalikes_and_plain_http() {
        for url in [
            "http://cdn-images.dzcdn.net/images/cover/abc/500x500.jpg",
            "https://example.com/cover.jpg",
            "https://evil-dzcdn.net/cover.jpg",
            "https://dzcdn.net.evil.com/cover.jpg",
            "https://evil.com/?host=api.dicebear.com",
            "file:///etc/passwd",
            "not a url",
        ] {
            assert!(!is_allowed_image_url(url), "{url}");
        }
    }

    #[test]
    fn artist_covers_live_in_their_own_folder_under_the_artist_key() {
        let library = Path::new("/music");

        assert_eq!(
            CoverKind::Album.cover_path(library, "Radiohead", "OK Computer"),
            library.join("jp3/assets/albums").join(format!("{}.jpg", cover_filename("Radiohead", "OK Computer")))
        );
        assert_eq!(
            CoverKind::Artist.cover_path(library, "Radiohead", "ignored"),
            library.join("jp3/assets/artists").join(format!("{}.jpg", cover_filename("Radiohead", "artist")))
        );
    }

    #[test]
    fn writing_a_cover_creates_its_folder_and_replaces_the_old_image() {
        let library = tempfile::tempdir().unwrap();
        let cover = CoverKind::Artist.cover_path(library.path(), "Radiohead", "");

        write_cover(&cover, b"first").unwrap();
        write_cover(&cover, b"second").unwrap();

        assert_eq!(std::fs::read(&cover).unwrap(), b"second");
    }

    #[test]
    fn removing_a_cover_deletes_the_file_and_is_safe_to_repeat() {
        let library = tempfile::tempdir().unwrap();
        let cover = CoverKind::Album.cover_path(library.path(), "Radiohead", "OK Computer");
        std::fs::create_dir_all(cover.parent().unwrap()).unwrap();
        std::fs::write(&cover, b"jpg").unwrap();

        remove_cover(&cover).unwrap();
        assert!(!cover.exists());

        remove_cover(&cover).expect("removing a cover that is already gone is not an error");
    }

    #[test]
    fn merge_alternates_sources_and_drops_duplicate_urls() {
        let merged = merge_candidates(vec![
            vec![candidate("a", "Deezer"), candidate("b", "Deezer")],
            vec![candidate("a", "iTunes"), candidate("c", "iTunes")],
        ]);

        let urls: Vec<&str> = merged.iter().map(|c| c.url.as_str()).collect();
        assert_eq!(urls, ["a", "b", "c"]);
    }

    #[test]
    fn merge_keeps_at_most_eight_and_gives_each_source_a_share() {
        let many = |source: &'static str| -> Vec<CoverCandidate> {
            (0..10).map(|i| candidate(&format!("{source}{i}"), source)).collect()
        };

        let merged = merge_candidates(vec![many("Deezer"), many("iTunes")]);

        assert_eq!(merged.len(), MAX_CANDIDATES);
        assert_eq!(merged.iter().filter(|c| c.source == "iTunes").count(), 4);
    }
}
