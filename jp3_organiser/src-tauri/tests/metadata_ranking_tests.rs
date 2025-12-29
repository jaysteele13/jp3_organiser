//! Integration tests for the metadata ranking service.
//!
//! Tests cover:
//! - Basic metadata extraction from AcoustID JSON responses
//! - Ranking algorithm (sources, dates, album type bonus)
//! - Edge cases (missing fields, empty recordings, etc.)

use jp3_organiser_lib::services::metadata_ranking_service::extract_metadata_from_acoustic_json;
use serde_json::json;

// =============================================================================
// Basic Extraction Tests
// =============================================================================

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

// =============================================================================
// Ranking Algorithm Tests
// =============================================================================

#[test]
fn test_ranking_prefers_higher_sources_when_dates_favor_same() {
    // When dates favor the same recording (older), higher sources should win
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
    // Song High wins because:
    // - Sources: Song High = 25 (rank 1), Song Low = 20 (rank 2)
    // - Date: Song High = 30 (oldest, rank 1), Song Low = 24 (rank 2)
    // - Album bonus: both get +10
    // Total: Song High = 65, Song Low = 54
    assert_eq!(result.title, Some("Song High".to_string()));
    assert_eq!(result.album, Some("Album High".to_string()));
}

#[test]
fn test_older_date_beats_higher_sources() {
    // Original album from 1978 should beat compilation from 2019 even with fewer sources
    let json = json!({
        "status": "ok",
        "results": [{
            "id": "test-result-id",
            "recordings": [
                {
                    "id": "new-compilation",
                    "title": "Don't Stop Me Now",
                    "sources": 3000,
                    "artists": [{"id": "1", "name": "Queen"}],
                    "releasegroups": [{
                        "id": "rg1",
                        "type": "Compilation",
                        "title": "Animal Crackers",
                        "releases": [{"id": "r1", "date": {"year": 2019}}]
                    }]
                },
                {
                    "id": "original-album",
                    "title": "Don't Stop Me Now",
                    "sources": 1500,
                    "artists": [{"id": "2", "name": "Queen"}],
                    "releasegroups": [{
                        "id": "rg2",
                        "type": "Album",
                        "title": "Jazz",
                        "releases": [{"id": "r2", "date": {"year": 1978}}]
                    }]
                }
            ]
        }]
    });

    let result = extract_metadata_from_acoustic_json(&json).unwrap();
    // Original album wins:
    // - Compilation: 25 (sources rank 1) + 24 (date rank 2) + 0 (no Album bonus) = 49
    // - Original: 20 (sources rank 2) + 30 (date rank 1) + 10 (Album bonus) = 60
    assert_eq!(result.title, Some("Don't Stop Me Now".to_string()));
    assert_eq!(result.album, Some("Jazz".to_string()));
    assert_eq!(result.year, Some(1978));
}

// =============================================================================
// Edge Cases and Error Handling
// =============================================================================

#[test]
fn test_no_recordings_returns_error() {
    let json = json!({
        "status": "ok",
        "results": []
    });

    let result = extract_metadata_from_acoustic_json(&json);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("No recordings"));
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

#[test]
fn test_error_status_returns_error() {
    let json = json!({
        "status": "error",
        "error": {
            "message": "invalid API key"
        }
    });

    let result = extract_metadata_from_acoustic_json(&json);
    assert!(result.is_err());
    assert!(result.unwrap_err().contains("status: error"));
}

#[test]
fn test_multiple_results_all_recordings_considered() {
    // Recordings from multiple results should all be considered
    let json = json!({
        "status": "ok",
        "results": [
            {
                "id": "result-1",
                "recordings": [{
                    "id": "rec-1",
                    "title": "Song From Result 1",
                    "sources": 100,
                    "artists": [{"id": "1", "name": "Artist 1"}],
                    "releasegroups": [{
                        "id": "rg1",
                        "type": "Album",
                        "title": "Album 1",
                        "releases": [{"id": "r1", "date": {"year": 2020}}]
                    }]
                }]
            },
            {
                "id": "result-2",
                "recordings": [{
                    "id": "rec-2",
                    "title": "Song From Result 2",
                    "sources": 5000,
                    "artists": [{"id": "2", "name": "Artist 2"}],
                    "releasegroups": [{
                        "id": "rg2",
                        "type": "Album",
                        "title": "Album 2",
                        "releases": [{"id": "r2", "date": {"year": 1978}}]
                    }]
                }]
            }
        ]
    });

    let result = extract_metadata_from_acoustic_json(&json).unwrap();
    // Result 2's recording should win (older date + higher sources)
    assert_eq!(result.title, Some("Song From Result 2".to_string()));
    assert_eq!(result.album, Some("Album 2".to_string()));
}
