//! Metadata ranking service for AcoustID JSON responses.
//!
//! This service ranks recording candidates from AcoustID API responses
//! to find the best metadata match for a song.
//!
//! # Ranking Algorithm
//!
//! Recordings are scored using a weighted point system:
//! - **Oldest release date**: Top 5 oldest get 30/24/18/12/6 points (older = original release)
//! - **Sources count**: Top 5 highest get 25/20/15/10/5 points (more sources = more reliable)
//! - **Album type bonus**: +10 points for recordings from an "Album" release group
//!
//! Ties are broken by sources count (higher wins).

use serde::Deserialize;

use crate::models::AudioMetadata;

// =============================================================================
// Ranking Configuration
// =============================================================================

/// Points awarded for oldest release dates (top 5 get points)
const DATE_POINTS: [u32; 5] = [30, 24, 18, 12, 6];

/// Points awarded for highest sources count (top 5 get points)
const SOURCES_POINTS: [u32; 5] = [25, 20, 15, 10, 5];

/// Bonus points for recordings with an "Album" release group
const ALBUM_TYPE_BONUS: u32 = 10;

// =============================================================================
// AcoustID Response Types
// =============================================================================

/// Date structure from AcoustID response.
#[derive(Debug, Clone, Deserialize)]
pub struct ReleaseDate {
    pub year: Option<i32>,
    #[serde(default)]
    pub month: Option<u32>,
    #[serde(default)]
    pub day: Option<u32>,
}

impl ReleaseDate {
    /// Convert to a sortable integer (YYYYMMDD format).
    /// Missing components default to latest possible (12/31) so incomplete dates sort later.
    fn to_sortable_int(&self) -> i64 {
        let year = self.year.unwrap_or(9999) as i64;
        let month = self.month.unwrap_or(12) as i64;
        let day = self.day.unwrap_or(31) as i64;
        year * 10000 + month * 100 + day
    }
}

/// Individual release within a release group.
#[derive(Debug, Clone, Deserialize)]
pub struct Release {
    /// MusicBrainz Release ID (MBID) - used for cover art fetching
    pub id: Option<String>,
    pub date: Option<ReleaseDate>,
    // Note: country, medium_count, track_count omitted - not used for ranking
}

/// Artist structure.
#[derive(Debug, Clone, Deserialize)]
pub struct Artist {
    #[serde(default)]
    pub name: String,
    // Note: id omitted - not used for ranking
}

/// Release group (album, single, compilation, etc.).
#[derive(Debug, Clone, Deserialize)]
pub struct ReleaseGroup {
    #[serde(rename = "type")]
    pub release_type: Option<String>,
    #[serde(default)]
    pub title: String,
    pub releases: Option<Vec<Release>>,
    // Note: id, artists omitted - not used for ranking
}

/// Recording from AcoustID response.
#[derive(Debug, Clone, Deserialize)]
pub struct Recording {
    #[serde(default)]
    pub title: String,
    pub sources: Option<u32>,
    pub artists: Option<Vec<Artist>>,
    pub releasegroups: Option<Vec<ReleaseGroup>>,
    // Note: id, duration omitted - not used for ranking
}

/// AcoustID result containing recordings.
#[derive(Debug, Clone, Deserialize)]
pub struct AcoustIdResult {
    pub recordings: Option<Vec<Recording>>,
    // Note: id, score omitted - not used for ranking
}

/// Full AcoustID API response.
#[derive(Debug, Clone, Deserialize)]
pub struct AcoustIdResponse {
    pub status: String,
    pub results: Option<Vec<AcoustIdResult>>,
}

// =============================================================================
// Public API
// =============================================================================

/// Extract metadata from AcoustID JSON response by ranking candidates.
///
/// # Arguments
/// * `json` - Raw AcoustID API response as `serde_json::Value`
///
/// # Returns
/// * `Ok(AudioMetadata)` - Best matching metadata based on ranking
/// * `Err(String)` - If no valid recordings found or parsing fails
///
/// # Example
/// ```ignore
/// let json = serde_json::json!({ "status": "ok", "results": [...] });
/// let metadata = extract_metadata_from_acoustic_json(&json)?;
/// ```
pub fn extract_metadata_from_acoustic_json(
    json: &serde_json::Value,
) -> Result<AudioMetadata, String> {
    let response: AcoustIdResponse = serde_json::from_value(json.clone())
        .map_err(|e| format!("Failed to parse AcoustID response: {}", e))?;

    extract_metadata_from_response(response)
}

/// Extract metadata from a parsed AcoustID response.
///
/// This is the main ranking implementation. Use this if you've already
/// deserialized the response to avoid double-parsing.
pub fn extract_metadata_from_response(
    response: AcoustIdResponse,
) -> Result<AudioMetadata, String> {
    if response.status != "ok" {
        return Err(format!("AcoustID API returned status: {}", response.status));
    }

    // Collect all recordings, filtering invalid ones
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

    log::info!("Ranking {} recordings", recordings.len());

    // Score all recordings
    let mut scored: Vec<ScoredRecording> = recordings
        .into_iter()
        .map(|rec| ScoredRecording::new(rec))
        .collect();

    // Apply ranking criteria
    apply_date_ranking(&mut scored);
    apply_sources_ranking(&mut scored);
    apply_album_bonus(&mut scored);

    // Sort by score descending, sources as tiebreaker
    scored.sort_by(|a, b| {
        b.score.cmp(&a.score)
            .then_with(|| b.recording.sources.unwrap_or(0).cmp(&a.recording.sources.unwrap_or(0)))
    });

    log_ranking_results(&scored);

    // Extract metadata from winner
    let best = scored.into_iter().next()
        .ok_or("No recordings after ranking")?;

    build_metadata(&best.recording)
}

// =============================================================================
// Scoring Implementation
// =============================================================================

/// A recording with its calculated ranking score.
#[derive(Debug)]
struct ScoredRecording {
    recording: Recording,
    score: u32,
}

impl ScoredRecording {
    fn new(recording: Recording) -> Self {
        Self { recording, score: 0 }
    }
}

/// Award points based on oldest release date (older = more points).
fn apply_date_ranking(scored: &mut [ScoredRecording]) {
    // Build (index, sortable_date) pairs, None sorts last
    let mut by_date: Vec<(usize, Option<i64>)> = scored
        .iter()
        .enumerate()
        .map(|(i, s)| (i, get_oldest_date(&s.recording).map(|d| d.to_sortable_int())))
        .collect();

    // Sort by date ascending (oldest first)
    by_date.sort_by(|a, b| match (&a.1, &b.1) {
        (Some(da), Some(db)) => da.cmp(db),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => std::cmp::Ordering::Equal,
    });

    // Award points to top 5
    for (rank, (idx, date)) in by_date.iter().take(5).enumerate() {
        if date.is_some() {
            scored[*idx].score += DATE_POINTS[rank];
        }
    }
}

/// Award points based on sources count (higher = more points).
fn apply_sources_ranking(scored: &mut [ScoredRecording]) {
    let mut by_sources: Vec<(usize, u32)> = scored
        .iter()
        .enumerate()
        .map(|(i, s)| (i, s.recording.sources.unwrap_or(0)))
        .collect();

    // Sort by sources descending
    by_sources.sort_by(|a, b| b.1.cmp(&a.1));

    // Award points to top 5 with non-zero sources
    for (rank, (idx, sources)) in by_sources.iter().take(5).enumerate() {
        if *sources > 0 {
            scored[*idx].score += SOURCES_POINTS[rank];
        }
    }
}

/// Award bonus points for recordings with an "Album" release group.
fn apply_album_bonus(scored: &mut [ScoredRecording]) {
    for s in scored.iter_mut() {
        if has_album_release_group(&s.recording) {
            s.score += ALBUM_TYPE_BONUS;
        }
    }
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Find the oldest release date across all release groups.
fn get_oldest_date(recording: &Recording) -> Option<ReleaseDate> {
    recording
        .releasegroups
        .as_ref()?
        .iter()
        .filter_map(|rg| rg.releases.as_ref())
        .flatten()
        .filter_map(|r| r.date.clone())
        .filter(|d| d.year.is_some())
        .min_by_key(|d| d.to_sortable_int())
}

/// Check if recording has an "Album" type release group.
fn has_album_release_group(recording: &Recording) -> bool {
    recording
        .releasegroups
        .as_ref()
        .map(|groups| groups.iter().any(|g| g.release_type.as_deref() == Some("Album")))
        .unwrap_or(false)
}

/// Get the preferred release group (Album preferred, then first available).
fn get_preferred_release_group(recording: &Recording) -> Option<&ReleaseGroup> {
    let groups = recording.releasegroups.as_ref()?;
    
    // Prefer Album type
    groups
        .iter()
        .find(|g| g.release_type.as_deref() == Some("Album") && !g.title.is_empty())
        .or_else(|| groups.iter().find(|g| !g.title.is_empty()))
}

/// Build AudioMetadata from a recording.
fn build_metadata(recording: &Recording) -> Result<AudioMetadata, String> {
    let title = recording.title.clone();
    if title.is_empty() {
        return Err("Recording has empty title".to_string());
    }

    let artist = recording
        .artists
        .as_ref()
        .and_then(|artists| artists.iter().find(|a| !a.name.is_empty()))
        .map(|a| a.name.clone())
        .ok_or("No artist found in recording")?;

    let release_group = get_preferred_release_group(recording)
        .ok_or("No release group found in recording")?;

    let album = release_group.title.clone();

    // Get the oldest release to extract year and MBID
    let oldest_release = release_group
        .releases
        .as_ref()
        .and_then(|releases| {
            releases
                .iter()
                .filter(|r| r.date.as_ref().and_then(|d| d.year).is_some())
                .min_by_key(|r| {
                    r.date
                        .as_ref()
                        .map(|d| d.to_sortable_int())
                        .unwrap_or(i64::MAX)
                })
        });

    let year = oldest_release.and_then(|r| r.date.as_ref()?.year);

    // Get release MBID - prefer from oldest release, fallback to first release with ID
    let release_mbid = oldest_release
        .and_then(|r| r.id.clone())
        .or_else(|| {
            release_group
                .releases
                .as_ref()
                .and_then(|releases| releases.iter().find_map(|r| r.id.clone()))
        });

    log::info!(
        "Selected: '{}' by '{}' from '{}' ({}) [MBID: {}]",
        title,
        artist,
        album,
        year.map(|y| y.to_string()).unwrap_or_else(|| "unknown year".to_string()),
        release_mbid.as_deref().unwrap_or("none")
    );

    Ok(AudioMetadata {
        title: Some(title),
        artist: Some(artist),
        album: Some(album),
        year,
        track_number: None,
        duration_secs: None,
        release_mbid,
    })
}

/// Log ranking results for debugging.
fn log_ranking_results(scored: &[ScoredRecording]) {
    log::info!("=== RANKING RESULTS ({} candidates) ===", scored.len());
    
    for (i, s) in scored.iter().take(10).enumerate() {
        let album = s.recording.releasegroups.as_ref()
            .and_then(|g| g.first())
            .map(|g| format!("{} ({})", g.title, g.release_type.as_deref().unwrap_or("?")))
            .unwrap_or_else(|| "No album".to_string());
        
        let artist = s.recording.artists.as_ref()
            .and_then(|a| a.first())
            .map(|a| a.name.as_str())
            .unwrap_or("Unknown");
        
        let year = get_oldest_date(&s.recording)
            .and_then(|d| d.year)
            .map(|y| y.to_string())
            .unwrap_or_else(|| "N/A".to_string());

        log::info!(
            "  #{}: score={:2} | '{}' by {} | {} | year: {} | sources: {}",
            i + 1,
            s.score,
            s.recording.title,
            artist,
            album,
            year,
            s.recording.sources.unwrap_or(0)
        );
    }
    
    if scored.len() > 10 {
        log::info!("  ... and {} more", scored.len() - 10);
    }
}
