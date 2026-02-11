//! Cover art Tauri commands.
//!
//! Commands for fetching and managing album and artist cover art.
//! 
//! Album covers are fetched from Cover Art Archive using MusicBrainz Release IDs.
//! Artist covers are fetched from Fanart.tv using MusicBrainz Artist IDs.
//! 
//! Cover files are named using a hash for stability across library compaction:
//! - Albums: hash of "artist|||album"
//! - Artists: hash of "artist|||artist" (uses "artist" as second component)

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
/// Tries the primary (MusicBrainz) MBID first, then falls back to the AcousticID MBID.
///
/// # Arguments
/// * `base_path` - Library base path
/// * `artist` - Artist name (for stable filename generation)
/// * `album` - Album name (for stable filename generation)
/// * `mbid` - MusicBrainz Release ID (from MusicBrainz search - primary)
/// * `acoustic_mbid` - AcousticID Release MBID (fallback, optional)
#[tauri::command]
pub async fn fetch_album_cover(
    base_path: String,
    artist: String,
    album: String,
    mbid: String,
    acoustic_mbid: Option<String>,
) -> Result<FetchCoverResult, String> {
    log::info!(
        "fetch_album_cover called: artist=\"{}\", album=\"{}\", mbid={}, acoustic_mbid={:?}",
        artist,
        album,
        mbid,
        acoustic_mbid
    );

    let albums_dir = Path::new(&base_path).join("jp3").join("assets").join("albums");

    // Check if already cached (using artist+album hash)
    if let Some(path) = cover_art_service::get_cover_path_by_name(&albums_dir, &artist, &album) {
        log::info!("Album cover already cached: {}", path);
        return Ok(FetchCoverResult {
            success: true,
            path: Some(path),
            error: None,
            was_cached: true,
        });
    }

    // Ensure albums directory exists
    if !albums_dir.exists() {
        std::fs::create_dir_all(&albums_dir).map_err(|e| {
            log::error!("Failed to create albums directory: {}", e);
            format!("Failed to create albums directory: {}", e)
        })?;
    }

    // Determine primary and fallback MBIDs
    let primary_mbid = if mbid.is_empty() { None } else { Some(mbid.as_str()) };
    let fallback_mbid = acoustic_mbid.as_deref().filter(|s| !s.is_empty());

    // Fetch and save album cover from Cover Art Archive with fallback
    match cover_art_service::fetch_and_save_album_cover(
        primary_mbid,
        fallback_mbid,
        &albums_dir,
        &artist,
        &album,
    ).await {
        Ok(result) => Ok(FetchCoverResult {
            success: true,
            path: Some(result.path),
            error: None,
            was_cached: false,
        }),
        Err(cover_art_service::CoverArtError::NotFound) => {
            log::info!("No album cover art available for MBIDs: primary={:?}, fallback={:?}", primary_mbid, fallback_mbid);
            Ok(FetchCoverResult {
                success: false,
                path: None,
                error: Some("No cover art available".to_string()),
                was_cached: false,
            })
        }
        Err(e) => {
            log::error!("Failed to fetch album cover art: {}", e);
            Ok(FetchCoverResult {
                success: false,
                path: None,
                error: Some(e.to_string()),
                was_cached: false,
            })
        }
    }
}

/// Fetch and cache cover art for an artist.
///
/// If cover already exists in cache, returns the cached path.
/// Otherwise, fetches from Fanart.tv using the Artist MBID.
/// Cover files are named using a hash of artist name for stability.
///
/// # Arguments
/// * `base_path` - Library base path
/// * `artist` - Artist name (for stable filename generation)
/// * `artist_mbid` - MusicBrainz Artist ID
#[tauri::command]
pub async fn fetch_artist_cover(
    base_path: String,
    artist: String,
    artist_mbid: String,
) -> Result<FetchCoverResult, String> {
    log::info!(
        "fetch_artist_cover called: artist=\"{}\", artist_mbid={}",
        artist,
        artist_mbid
    );

    let artists_dir = Path::new(&base_path).join("jp3").join("assets").join("artists");

    // Check if already cached (using artist hash - we use "artist" as the album component)
    if let Some(path) = cover_art_service::get_cover_path_by_name(&artists_dir, &artist, "artist") {
        log::info!("Artist cover already cached: {}", path);
        return Ok(FetchCoverResult {
            success: true,
            path: Some(path),
            error: None,
            was_cached: true,
        });
    }

    // Ensure artists directory exists
    if !artists_dir.exists() {
        std::fs::create_dir_all(&artists_dir).map_err(|e| {
            log::error!("Failed to create artists directory: {}", e);
            format!("Failed to create artists directory: {}", e)
        })?;
    }

    // Fetch and save artist cover from Fanart.tv
    match cover_art_service::fetch_and_save_artist_cover(&artist_mbid, &artists_dir, &artist).await {
        Ok(result) => Ok(FetchCoverResult {
            success: true,
            path: Some(result.path),
            error: None,
            was_cached: false,
        }),
        Err(cover_art_service::CoverArtError::NotFound) => {
            log::info!("No artist cover art available for MBID: {}", artist_mbid);
            Ok(FetchCoverResult {
                success: false,
                path: None,
                error: Some("No artist cover available".to_string()),
                was_cached: false,
            })
        }
        Err(e) => {
            log::error!("Failed to fetch artist cover art: {}", e);
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
/// Uses artist+album hash for stable filename lookup.
///
/// # Arguments
/// * `base_path` - Library base path
/// * `artist` - Artist name
/// * `album` - Album name
#[tauri::command]
pub fn get_album_cover_path(
    base_path: String,
    artist: String,
    album: String,
) -> GetCoverPathResult {
    let album_dir = Path::new(&base_path).join("jp3/assets").join("albums");

    match cover_art_service::get_cover_path_by_name(&album_dir
, &artist, &album) {
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
/// Uses artist+album hash for stable filename lookup.
///
/// # Arguments
/// * `base_path` - Library base path  
/// * `artist` - Artist name
/// * `album` - Album name
#[tauri::command]
pub fn read_album_cover(
    base_path: String,
    artist: String,
    album: String,
) -> Result<Vec<u8>, String> {
    let album_dir = Path::new(&base_path).join("jp3/assets").join("albums");
    let filename = cover_art_service::cover_filename(&artist, &album);
    let cover_path = album_dir.join(format!("{}.jpg", filename));

    if !cover_path.exists() {
        return Err("Cover not found".to_string());
    }

    std::fs::read(&cover_path).map_err(|e| {
        log::error!("Failed to read cover file: {}", e);
        format!("Failed to read cover: {}", e)
    })
}

/// Read artist cover image bytes for displaying in frontend.
///
/// This is useful when the frontend needs the raw image data
/// rather than a file path (e.g., for blob URLs).
/// Uses artist hash for stable filename lookup.
///
/// # Arguments
/// * `base_path` - Library base path  
/// * `artist` - Artist name
#[tauri::command]
pub fn read_artist_cover(
    base_path: String,
    artist: String,
) -> Result<Vec<u8>, String> {
    let artist_dir = Path::new(&base_path).join("jp3/assets").join("artists");
    // Use "artist" as the second component for consistency with fetch_artist_cover
    let filename = cover_art_service::cover_filename(&artist, "artist");
    let cover_path = artist_dir.join(format!("{}.jpg", filename));

    if !cover_path.exists() {
        return Err("Artist cover not found".to_string());
    }

    std::fs::read(&cover_path).map_err(|e| {
        log::error!("Failed to read artist cover file: {}", e);
        format!("Failed to read artist cover: {}", e)
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

/// Result of clearing cover cache
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearCoverCacheResult {
    /// Whether the operation was successful
    pub success: bool,
    /// Number of album covers cleared
    pub albums_cleared: u32,
    /// Number of artist covers cleared  
    pub artists_cleared: u32,
    /// Error message (if failed)
    pub error: Option<String>,
}

/// Clear all cached cover art for albums and artists.
///
/// This safely removes all cached cover images from:
/// - {library_path}/jp3/assets/albums/
/// - {library_path}/jp3/assets/artists/
///
/// The directories are preserved (only .jpg files are deleted).
/// This is useful when API keys were incorrect or corrupted cache needs clearing.
///
/// # Arguments
/// * `base_path` - Library base path
#[tauri::command]
pub fn clear_cover_cache(base_path: String) -> ClearCoverCacheResult {
    log::info!("clear_cover_cache called for base_path: {}", base_path);

    let albums_dir = Path::new(&base_path).join("jp3").join("assets").join("albums");
    let artists_dir = Path::new(&base_path).join("jp3").join("assets").join("artists");

    let mut albums_cleared = 0u32;
    let mut artists_cleared = 0u32;

    // Clear album covers
    if albums_dir.exists() {
        match std::fs::read_dir(&albums_dir) {
            Ok(entries) => {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_file() {
                            if let Some(extension) = path.extension() {
                                if extension == "jpg" {
                                    match std::fs::remove_file(&path) {
                                        Ok(_) => {
                                            albums_cleared += 1;
                                            log::debug!("Removed album cover: {:?}", path);
                                        }
                                        Err(e) => {
                                            log::error!("Failed to remove album cover {:?}: {}", path, e);
                                            return ClearCoverCacheResult {
                                                success: false,
                                                albums_cleared: 0,
                                                artists_cleared: 0,
                                                error: Some(format!("Failed to remove album cover: {}", e)),
                                            };
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                log::info!("Cleared {} album covers from {:?}", albums_cleared, albums_dir);
            }
            Err(e) => {
                log::error!("Failed to read albums directory {:?}: {}", albums_dir, e);
                return ClearCoverCacheResult {
                    success: false,
                    albums_cleared: 0,
                    artists_cleared: 0,
                    error: Some(format!("Failed to read albums directory: {}", e)),
                };
            }
        }
    } else {
        log::info!("Albums directory does not exist: {:?}", albums_dir);
    }

    // Clear artist covers
    if artists_dir.exists() {
        match std::fs::read_dir(&artists_dir) {
            Ok(entries) => {
                for entry in entries {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_file() {
                            if let Some(extension) = path.extension() {
                                if extension == "jpg" {
                                    match std::fs::remove_file(&path) {
                                        Ok(_) => {
                                            artists_cleared += 1;
                                            log::debug!("Removed artist cover: {:?}", path);
                                        }
                                        Err(e) => {
                                            log::error!("Failed to remove artist cover {:?}: {}", path, e);
                                            return ClearCoverCacheResult {
                                                success: false,
                                                albums_cleared,
                                                artists_cleared,
                                                error: Some(format!("Failed to remove artist cover: {}", e)),
                                            };
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                log::info!("Cleared {} artist covers from {:?}", artists_cleared, artists_dir);
            }
            Err(e) => {
                log::error!("Failed to read artists directory {:?}: {}", artists_dir, e);
                return ClearCoverCacheResult {
                    success: false,
                    albums_cleared,
                    artists_cleared: 0,
                    error: Some(format!("Failed to read artists directory: {}", e)),
                };
            }
        }
    } else {
        log::info!("Artists directory does not exist: {:?}", artists_dir);
    }

    let total_cleared = albums_cleared + artists_cleared;
    log::info!("Cover cache clear complete: {} total files cleared", total_cleared);

    ClearCoverCacheResult {
        success: true,
        albums_cleared,
        artists_cleared,
        error: None,
    }
}
