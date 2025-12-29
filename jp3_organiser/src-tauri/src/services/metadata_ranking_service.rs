//! Metadata ranking service for AcoustID JSON responses.
//!
//! This service ranks recording candidates from AcoustID API responses
//! to find the best metadata match for a song.

use serde::Deserialize;
use crate::models::AudioMetadata;

/// Date structure from AcoustID response
#[derive(Debug, Clone, Deserialize)]
pub struct ReleaseDate {
    pub year: Option<i32>,
    pub month: Option<u32>,
    pub day: Option<u32>,
}

impl ReleaseDate {
    /// Convert to a comparable integer (YYYYMMDD format)
    /// Earlier dates get lower values
    pub fn to_sortable_int(&self) -> i64 {
        let year = self.year.unwrap_or(9999) as i64;
        let month = self.month.unwrap_or(12) as i64;
        let day = self.day.unwrap_or(31) as i64;
        year * 10000 + month * 100 + day
    }
}

/// Individual release within a release group
#[derive(Debug, Clone, Deserialize)]
pub struct Release {
    #[serde(default)]
    pub id: String,
    pub country: Option<String>,
    pub date: Option<ReleaseDate>,
    pub medium_count: Option<u32>,
    pub track_count: Option<u32>,
}

/// Artist structure
#[derive(Debug, Clone, Deserialize)]
pub struct Artist {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub name: String,
}

/// Release group (album, single, compilation, etc.)
#[derive(Debug, Clone, Deserialize)]
pub struct ReleaseGroup {
    #[serde(default)]
    pub id: String,
    #[serde(rename = "type")]
    pub release_type: Option<String>,
    #[serde(default)]
    pub title: String,
    pub artists: Option<Vec<Artist>>,
    pub releases: Option<Vec<Release>>,
}

/// Recording from AcoustID response
#[derive(Debug, Clone, Deserialize)]
pub struct Recording {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub title: String,
    pub duration: Option<f64>,
    pub sources: Option<u32>,
    pub artists: Option<Vec<Artist>>,
    pub releasegroups: Option<Vec<ReleaseGroup>>,
}

/// AcoustID result containing recordings
#[derive(Debug, Clone, Deserialize)]
pub struct AcoustIdResult {
    pub id: String,
    pub score: Option<f64>,
    pub recordings: Option<Vec<Recording>>,
}

/// Full AcoustID API response
#[derive(Debug, Clone, Deserialize)]
pub struct AcoustIdResponse {
    pub status: String,
    pub results: Option<Vec<AcoustIdResult>>,
}

/// Points awarded for sources ranking (top 5 get points) - increased weight
const SOURCES_POINTS: [u32; 5] = [25, 20, 15, 10, 5];

/// Points awarded for date ranking (top 5 get points) - higher weight for older dates
const DATE_POINTS: [u32; 5] = [30, 24, 18, 12, 6];

/// Bonus points for having an Album type release group
const ALBUM_TYPE_BONUS: u32 = 10;

/// Internal structure to track recording with its ranking score
#[derive(Debug)]
struct RankedRecording {
    recording: Recording,
    score: u32,
}

/// Find the oldest release date from a recording's release groups
fn get_oldest_release_date(recording: &Recording) -> Option<ReleaseDate> {
    recording.releasegroups.as_ref().and_then(|groups| {
        groups
            .iter()
            .filter_map(|group| {
                group.releases.as_ref().and_then(|releases| {
                    releases
                        .iter()
                        .filter_map(|r| r.date.clone())
                        .filter(|d| d.year.is_some())
                        .min_by_key(|d| d.to_sortable_int())
                })
            })
            .min_by_key(|d| d.to_sortable_int())
    })
}

/// Get the first album release group from a recording
fn get_album_release_group(recording: &Recording) -> Option<&ReleaseGroup> {
    recording.releasegroups.as_ref().and_then(|groups| {
        groups
            .iter()
            .find(|g| g.release_type.as_deref() == Some("Album"))
    })
}

/// Get the first release group (any type) from a recording
fn get_first_release_group(recording: &Recording) -> Option<&ReleaseGroup> {
    recording.releasegroups.as_ref().and_then(|groups| groups.first())
}

/// Extract metadata from AcoustID JSON response by ranking candidates.
///
/// Ranking criteria (in order of importance):
/// 1. Oldest release date (older = more likely original, top 5 get 30/24/18/12/6 points)
/// 2. Sources count (higher = more reputable, top 5 get 20/16/12/8/4 points)
/// 3. Album type bonus (recordings with Album release group get +15 points)
///
/// Returns the best matching metadata or None if no valid recordings found.
pub fn extract_metadata_from_acoustic_json(
    json: &serde_json::Value,
) -> Result<AudioMetadata, String> {
    log::info!("extract_metadata_from_acoustic_json called");

    // Parse the JSON into our structures
    let response: AcoustIdResponse = serde_json::from_value(json.clone())
        .map_err(|e| format!("Failed to parse AcoustID response: {}", e))?;

    if response.status != "ok" {
        return Err(format!("AcoustID API returned status: {}", response.status));
    }

    // Collect all recordings from all results, filtering out those with empty titles
    let recordings: Vec<Recording> = response
        .results
        .unwrap_or_default()
        .into_iter()
        .flat_map(|result| result.recordings.unwrap_or_default())
        .filter(|r| !r.title.is_empty())
        .collect();

    if recordings.is_empty() {
        return Err("No recordings found in AcoustID response".to_string());
    }

    log::info!("Found {} recordings to rank", recordings.len());

    // Create ranked recordings with initial score of 0
    let mut ranked: Vec<RankedRecording> = recordings
        .into_iter()
        .map(|recording| RankedRecording { recording, score: 0 })
        .collect();

    // Rank by sources (higher is better)
    rank_by_sources(&mut ranked);

    // Rank by oldest release date (older is better) - higher weight
    rank_by_oldest_date(&mut ranked);

    // Bonus for having an Album type release group
    rank_by_album_type(&mut ranked);

    // Sort by score descending, then by sources descending as tiebreaker
    ranked.sort_by(|a, b| {
        match b.score.cmp(&a.score) {
            std::cmp::Ordering::Equal => {
                // Tiebreaker: higher sources wins
                b.recording.sources.unwrap_or(0).cmp(&a.recording.sources.unwrap_or(0))
            }
            other => other,
        }
    });

    // Log all candidates with their scores
    log::info!("=== RANKING RESULTS ({} candidates) ===", ranked.len());
    
    for (i, r) in ranked.iter().enumerate() {
        let album_info = r.recording.releasegroups.as_ref()
            .and_then(|groups| groups.first())
            .map(|g| format!("{} ({})", g.title, g.release_type.as_deref().unwrap_or("Unknown")))
            .unwrap_or_else(|| "No album".to_string());
        
        let artist = r.recording.artists.as_ref()
            .and_then(|artists| artists.first())
            .map(|a| a.name.clone())
            .unwrap_or_else(|| "Unknown".to_string());
        
        let oldest_year = get_oldest_release_date(&r.recording)
            .and_then(|d| d.year)
            .map(|y| y.to_string())
            .unwrap_or_else(|| "N/A".to_string());
        
        let sources = r.recording.sources.unwrap_or(0);
        
        log::info!(
            "  #{}: score={} | '{}' by {} | album: {} | year: {} | sources: {}",
            i + 1,
            r.score,
            r.recording.title,
            artist,
            album_info,
            oldest_year,
            sources
        );
    }
    log::info!("=== END RANKING ===");

    let best = ranked
        .into_iter()
        .next()
        .ok_or("No recordings after ranking")?;

    log::info!(
        "SELECTED: '{}' (album: '{}', artist: '{}') with score {}",
        best.recording.title,
        best.recording.releasegroups.as_ref().and_then(|groups| groups.first()).map(|g| g.title.clone()).unwrap_or_default(),
        best.recording.artists.as_ref().and_then(|artists| artists.first()).map(|a| a.name.clone()).unwrap_or_default(),
        best.score
    );

    // Extract metadata from best recording
    build_audio_metadata(&best.recording)
}

/// Award points based on sources count (higher sources = more points)
fn rank_by_sources(ranked: &mut [RankedRecording]) {
    // Sort by sources descending
    let mut sources_order: Vec<(usize, u32)> = ranked
        .iter()
        .enumerate()
        .map(|(i, r)| (i, r.recording.sources.unwrap_or(0)))
        .collect();

    sources_order.sort_by(|a, b| b.1.cmp(&a.1));

    // Award points to top 5
    for (rank, (idx, sources)) in sources_order.iter().take(5).enumerate() {
        if *sources > 0 {
            ranked[*idx].score += SOURCES_POINTS[rank];
            log::debug!(
                "Sources rank {}: '{}' with {} sources gets {} points",
                rank + 1,
                ranked[*idx].recording.title,
                sources,
                SOURCES_POINTS[rank]
            );
        }
    }
}

/// Award points based on oldest release date (older = more points)
fn rank_by_oldest_date(ranked: &mut [RankedRecording]) {
    // Get oldest dates for each recording
    let mut date_order: Vec<(usize, Option<ReleaseDate>)> = ranked
        .iter()
        .enumerate()
        .map(|(i, r)| (i, get_oldest_release_date(&r.recording)))
        .collect();

    // Sort by date ascending (oldest first), None values go last
    date_order.sort_by(|a, b| match (&a.1, &b.1) {
        (Some(date_a), Some(date_b)) => date_a.to_sortable_int().cmp(&date_b.to_sortable_int()),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => std::cmp::Ordering::Equal,
    });

    // Award points to top 5 (higher weight than sources)
    for (rank, (idx, date)) in date_order.iter().take(5).enumerate() {
        if let Some(d) = date {
            ranked[*idx].score += DATE_POINTS[rank];
            log::debug!(
                "Date rank {}: '{}' with year {:?} gets {} points",
                rank + 1,
                ranked[*idx].recording.title,
                d.year,
                DATE_POINTS[rank]
            );
        }
    }
}

/// Award bonus points for recordings with an Album type release group
fn rank_by_album_type(ranked: &mut [RankedRecording]) {
    for r in ranked.iter_mut() {
        if get_album_release_group(&r.recording).is_some() {
            r.score += ALBUM_TYPE_BONUS;
            log::debug!(
                "Album type bonus: '{}' gets {} points",
                r.recording.title,
                ALBUM_TYPE_BONUS
            );
        }
    }
}

/// Build AudioMetadata from the best ranked recording
fn build_audio_metadata(recording: &Recording) -> Result<AudioMetadata, String> {
    let title = recording.title.clone();

    if title.is_empty() {
        return Err("Recording has empty title".to_string());
    }

    // Get artist from recording level, filter out empty names
    let artist = recording
        .artists
        .as_ref()
        .and_then(|artists| artists.iter().find(|a| !a.name.is_empty()))
        .map(|a| a.name.clone())
        .ok_or("No artist found in recording")?;

    // Prefer album release groups, fallback to first release group
    // Filter out release groups with empty titles
    let release_group = get_album_release_group(recording)
        .filter(|rg| !rg.title.is_empty())
        .or_else(|| get_first_release_group(recording).filter(|rg| !rg.title.is_empty()))
        .ok_or("No release group found in recording")?;

    let album = release_group.title.clone();

    // Get year from oldest release in the release group
    let year = release_group
        .releases
        .as_ref()
        .and_then(|releases| {
            releases
                .iter()
                .filter_map(|r| r.date.as_ref())
                .filter_map(|d| d.year)
                .min()
        });

    log::info!(
        "Built metadata: title='{}', artist='{}', album='{}', year={:?}",
        title,
        artist,
        album,
        year
    );

    Ok(AudioMetadata {
        title: Some(title),
        artist: Some(artist),
        album: Some(album),
        year,
        track_number: None,
        duration_secs: None,
    })
}
