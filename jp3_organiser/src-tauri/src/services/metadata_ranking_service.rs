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

/// Points awarded for ranking (top 5 get points)
const RANKING_POINTS: [u32; 5] = [20, 16, 12, 8, 4];

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
/// Ranking criteria:
/// 1. Sources count (higher = more reputable, top 5 get 20/16/12/8/4 points)
/// 2. Oldest release date (older = more likely original, top 5 get 20/16/12/8/4 points)
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

    // Rank by oldest release date (older is better)
    rank_by_oldest_date(&mut ranked);

    // Find the recording with highest score
    ranked.sort_by(|a, b| b.score.cmp(&a.score));

    let best = ranked
        .into_iter()
        .next()
        .ok_or("No recordings after ranking")?;

        log::info!(
        "Best recording: '{}' (album: '{}', artist: '{}') with score {}",
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
            ranked[*idx].score += RANKING_POINTS[rank];
            log::debug!(
                "Sources rank {}: '{}' with {} sources gets {} points",
                rank + 1,
                ranked[*idx].recording.title,
                sources,
                RANKING_POINTS[rank]
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

    // Award points to top 5
    for (rank, (idx, date)) in date_order.iter().take(5).enumerate() {
        if let Some(d) = date {
            ranked[*idx].score += RANKING_POINTS[rank];
            log::debug!(
                "Date rank {}: '{}' with year {:?} gets {} points",
                rank + 1,
                ranked[*idx].recording.title,
                d.year,
                RANKING_POINTS[rank]
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_extract_metadata_basic() {
        let json = json!({
            "status": "ok",
            "results": [{
                "id": "test-result-id",
                "score": 0.95,
                "recordings": [{
                    "id": "cca05c80-3941-4e26-a855-d4316c9cad6d",
                    "title": "Jealousy",
                    "duration": 193.6,
                    "sources": 2518,
                    "artists": [{
                        "id": "0383dadf-2a4e-4d10-a46a-e9e041da8eb3",
                        "name": "Queen"
                    }],
                    "releasegroups": [{
                        "id": "c192ea46-7377-34f0-b332-dd9810edd560",
                        "type": "Album",
                        "title": "Jazz",
                        "artists": [{
                            "id": "0383dadf-2a4e-4d10-a46a-e9e041da8eb3",
                            "name": "Queen"
                        }],
                        "releases": [{
                            "id": "993f394d-895d-4fbb-9733-f9e98e0afdd6",
                            "country": "GB",
                            "date": {
                                "year": 1978,
                                "month": 11,
                                "day": 10
                            },
                            "medium_count": 1,
                            "track_count": 13
                        }]
                    }]
                }]
            }]
        });

        let result = extract_metadata_from_acoustic_json(&json).unwrap();
        assert_eq!(result.title, Some("Jealousy".to_string()));
        assert_eq!(result.artist, Some("Queen".to_string()));
        assert_eq!(result.album, Some("Jazz".to_string()));
        assert_eq!(result.year, Some(1978));
        assert_eq!(result.track_number, None);
        assert_eq!(result.duration_secs, None);
    }

    #[test]
    fn test_ranking_prefers_higher_sources() {
        // Song High has 5000 sources vs 100, so even though dates are same,
        // the sources difference should dominate when high sources also has
        // an equal or older date
        let json = json!({
            "status": "ok",
            "results": [{
                "id": "test-result-id",
                "recordings": [
                    {
                        "id": "low-sources",
                        "title": "Song Low",
                        "sources": 100,
                        "artists": [{"id": "1", "name": "Artist"}],
                        "releasegroups": [{
                            "id": "rg1",
                            "type": "Album",
                            "title": "Album Low",
                            "releases": [{"id": "r1", "date": {"year": 1990}}]
                        }]
                    },
                    {
                        "id": "high-sources",
                        "title": "Song High",
                        "sources": 5000,
                        "artists": [{"id": "2", "name": "Artist"}],
                        "releasegroups": [{
                            "id": "rg2",
                            "type": "Album",
                            "title": "Album High",
                            "releases": [{"id": "r2", "date": {"year": 1978}}]
                        }]
                    }
                ]
            }]
        });

        let result = extract_metadata_from_acoustic_json(&json).unwrap();
        // Song High wins: 20 (sources rank 1) + 20 (oldest date) = 40
        // Song Low gets: 16 (sources rank 2) + 16 (newer date) = 32
        assert_eq!(result.title, Some("Song High".to_string()));
        assert_eq!(result.album, Some("Album High".to_string()));
    }

    #[test]
    fn test_release_date_sorting() {
        let date1 = ReleaseDate {
            year: Some(1978),
            month: Some(11),
            day: Some(10),
        };
        let date2 = ReleaseDate {
            year: Some(1990),
            month: Some(1),
            day: Some(1),
        };

        assert!(date1.to_sortable_int() < date2.to_sortable_int());
    }

    #[test]
    fn test_no_recordings_returns_error() {
        let json = json!({
            "status": "ok",
            "results": []
        });

        let result = extract_metadata_from_acoustic_json(&json);
        assert!(result.is_err());
    }

    #[test]
    fn test_missing_title_field_handled() {
        // Recording without a title field should be filtered out
        let json = json!({
            "status": "ok",
            "results": [{
                "id": "test-result-id",
                "recordings": [{
                    "id": "no-title-recording",
                    "sources": 100,
                    "artists": [{"id": "1", "name": "Artist"}],
                    "releasegroups": [{
                        "id": "rg1",
                        "type": "Album",
                        "title": "Album"
                    }]
                }]
            }]
        });

        // Should error because the only recording has no title
        let result = extract_metadata_from_acoustic_json(&json);
        assert!(result.is_err());
    }

    #[test]
    fn test_skips_recordings_without_title() {
        // Should skip the recording without title and use the one with title
        let json = json!({
            "status": "ok",
            "results": [{
                "id": "test-result-id",
                "recordings": [
                    {
                        "id": "no-title-recording",
                        "sources": 5000,
                        "artists": [{"id": "1", "name": "Artist"}],
                        "releasegroups": [{
                            "id": "rg1",
                            "type": "Album",
                            "title": "Album"
                        }]
                    },
                    {
                        "id": "has-title-recording",
                        "title": "Good Song",
                        "sources": 100,
                        "artists": [{"id": "2", "name": "Good Artist"}],
                        "releasegroups": [{
                            "id": "rg2",
                            "type": "Album",
                            "title": "Good Album"
                        }]
                    }
                ]
            }]
        });

        let result = extract_metadata_from_acoustic_json(&json).unwrap();
        assert_eq!(result.title, Some("Good Song".to_string()));
        assert_eq!(result.album, Some("Good Album".to_string()));
    }
}
