//! Cover art Tauri commands.
//!
//! Commands for fetching and managing album cover art.

use serde::Serialize;
use std::path::Path;

use crate::services::cover_art_service;
use crate::services::musicbrainz_service;

/// Result of fetching cover art
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchCoverResult {
    /// Whether the fetch was successful
    pub success: bool,
    /// Path to the cached cover image (if successful)
    pub path: Option<String>,
    /// Error message (if failed)
    pub error: Option<String>,
    /// Whether the cover was already cached
    pub was_cached: bool,
}

/// Result of getting cover path
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetCoverPathResult {
    /// Whether cover exists
    pub exists: bool,
    /// Path to cover (if exists)
    pub path: Option<String>,
}

/// Fetch and cache cover art for an album.
///
/// If cover already exists in cache, returns the cached path.
/// Otherwise, fetches from Cover Art Archive using the MBID.
///
/// # Arguments
/// * `base_path` - Library base path
/// * `album_id` - Album ID for the filename
/// * `mbid` - MusicBrainz Release ID
#[tauri::command]
pub async fn fetch_album_cover(
    base_path: String,
    album_id: u32,
    mbid: String,
) -> Result<FetchCoverResult, String> {
    log::info!(
        "fetch_album_cover called: album_id={}, mbid={}",
        album_id,
        mbid
    );

    let covers_dir = Path::new(&base_path).join("jp3").join("covers");

    // Check if already cached
    if let Some(path) = cover_art_service::get_cover_path(&covers_dir, album_id) {
        log::info!("Cover already cached: {}", path);
        return Ok(FetchCoverResult {
            success: true,
            path: Some(path),
            error: None,
            was_cached: true,
        });
    }

    // Ensure covers directory exists
    if !covers_dir.exists() {
        std::fs::create_dir_all(&covers_dir).map_err(|e| {
            log::error!("Failed to create covers directory: {}", e);
            format!("Failed to create covers directory: {}", e)
        })?;
    }

    // Fetch and save
    match cover_art_service::fetch_and_save_cover(&mbid, &covers_dir, album_id).await {
        Ok(result) => Ok(FetchCoverResult {
            success: true,
            path: Some(result.path),
            error: None,
            was_cached: false,
        }),
        Err(cover_art_service::CoverArtError::NotFound) => {
            log::info!("No cover art available for MBID: {}", mbid);
            Ok(FetchCoverResult {
                success: false,
                path: None,
                error: Some("No cover art available".to_string()),
                was_cached: false,
            })
        }
        Err(e) => {
            log::error!("Failed to fetch cover art: {}", e);
            Ok(FetchCoverResult {
                success: false,
                path: None,
                error: Some(e.to_string()),
                was_cached: false,
            })
        }
    }
}

/// Get the cached cover path for an album.
///
/// Returns the path if the cover exists in cache, None otherwise.
///
/// # Arguments
/// * `base_path` - Library base path
/// * `album_id` - Album ID
#[tauri::command]
pub fn get_album_cover_path(base_path: String, album_id: u32) -> GetCoverPathResult {
    let covers_dir = Path::new(&base_path).join("jp3").join("covers");

    match cover_art_service::get_cover_path(&covers_dir, album_id) {
        Some(path) => GetCoverPathResult {
            exists: true,
            path: Some(path),
        },
        None => GetCoverPathResult {
            exists: false,
            path: None,
        },
    }
}

/// Read cover image bytes for displaying in frontend.
///
/// This is useful when the frontend needs the raw image data
/// rather than a file path (e.g., for blob URLs).
///
/// # Arguments
/// * `base_path` - Library base path  
/// * `album_id` - Album ID
#[tauri::command]
pub fn read_album_cover(base_path: String, album_id: u32) -> Result<Vec<u8>, String> {
    let covers_dir = Path::new(&base_path).join("jp3").join("covers");
    let cover_path = covers_dir.join(format!("{}.jpg", album_id));

    if !cover_path.exists() {
        return Err("Cover not found".to_string());
    }

    std::fs::read(&cover_path).map_err(|e| {
        log::error!("Failed to read cover file: {}", e);
        format!("Failed to read cover: {}", e)
    })
}

/// Result of searching for a release MBID
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchReleaseMbidResult {
    /// Whether a release was found
    pub found: bool,
    /// MusicBrainz Release ID (MBID)
    pub mbid: Option<String>,
    /// Matched release title
    pub title: Option<String>,
    /// Matched artist name
    pub artist: Option<String>,
    /// Search score (0-100)
    pub score: Option<u32>,
}

/// Search for a release MBID using MusicBrainz API.
///
/// This searches the MusicBrainz database by artist and album name,
/// returning the best matching release MBID for use with Cover Art Archive.
///
/// This is more accurate than using AcoustID's MBID because it uses
/// the user-confirmed album metadata rather than fingerprint matching.
///
/// # Arguments
/// * `artist` - Artist name
/// * `album` - Album/release name
///
/// # Rate Limiting
/// This command respects MusicBrainz's rate limit of 1 request per second.
/// Multiple concurrent calls will be queued automatically.
#[tauri::command]
pub async fn search_album_mbid(artist: String, album: String) -> SearchReleaseMbidResult {
    log::info!(
        "search_album_mbid called: artist=\"{}\", album=\"{}\"",
        artist,
        album
    );

    match musicbrainz_service::search_release(&artist, &album).await {
        Ok(Some(result)) => {
            log::info!(
                "Found release: \"{}\" by {:?} (MBID: {}, score: {})",
                result.title,
                result.artist,
                result.release_mbid,
                result.score
            );
            SearchReleaseMbidResult {
                found: true,
                mbid: Some(result.release_mbid),
                title: Some(result.title),
                artist: result.artist,
                score: Some(result.score),
            }
        }
        Ok(None) => {
            log::info!("No release found for \"{}\" - \"{}\"", artist, album);
            SearchReleaseMbidResult {
                found: false,
                mbid: None,
                title: None,
                artist: None,
                score: None,
            }
        }
        Err(e) => {
            log::error!("Search failed: {}", e);
            SearchReleaseMbidResult {
                found: false,
                mbid: None,
                title: None,
                artist: None,
                score: None,
            }
        }
    }
}

/// Batch search for multiple release MBIDs using MusicBrainz API.
///
/// Processes each search sequentially with proper rate limiting.
/// This is more efficient than calling search_album_mbid multiple times
/// as it manages rate limiting internally.
///
/// # Arguments
/// * `queries` - Array of {artist, album} objects to search
///
/// # Returns
/// Array of results in the same order as input queries
#[tauri::command]
pub async fn search_album_mbids_batch(
    queries: Vec<AlbumQuery>,
) -> Vec<SearchReleaseMbidResult> {
    log::info!(
        "search_album_mbids_batch called with {} queries",
        queries.len()
    );

    let query_tuples: Vec<(String, String)> = queries
        .into_iter()
        .map(|q| (q.artist, q.album))
        .collect();

    let results = musicbrainz_service::search_releases_batch(&query_tuples).await;

    results
        .into_iter()
        .map(|opt| match opt {
            Some(result) => SearchReleaseMbidResult {
                found: true,
                mbid: Some(result.release_mbid),
                title: Some(result.title),
                artist: result.artist,
                score: Some(result.score),
            },
            None => SearchReleaseMbidResult {
                found: false,
                mbid: None,
                title: None,
                artist: None,
                score: None,
            },
        })
        .collect()
}

/// Query structure for batch album MBID search
#[derive(Debug, Clone, serde::Deserialize)]
pub struct AlbumQuery {
    pub artist: String,
    pub album: String,
}
