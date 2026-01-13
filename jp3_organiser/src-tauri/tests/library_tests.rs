//! Integration tests for library management commands.
//!
//! Tests cover:
//! - Library initialization and structure
//! - Saving files with string deduplication
//! - Duplicate song detection (across batches and within batch)
//! - Soft delete operations
//! - Metadata editing
//! - Library compaction
//! - Edit with playlist remapping

use jp3_organiser_lib::commands::library::{
    compact_library, delete_songs, edit_song_metadata, get_library_stats, initialize_library,
    load_library, save_to_library, FileToSave,
};
use jp3_organiser_lib::commands::playlist::{create_playlist, load_playlist};
use jp3_organiser_lib::models::AudioMetadata;

/// Helper to create a test environment with initialized library.
fn setup_test_library() -> (tempfile::TempDir, String) {
    let temp_dir = tempfile::TempDir::new().unwrap();
    let base_path = temp_dir.path().to_string_lossy().to_string();
    initialize_library(base_path.clone()).unwrap();
    (temp_dir, base_path)
}

/// Helper to create a dummy audio file and return its path.
fn create_dummy_audio_file(temp_dir: &tempfile::TempDir, name: &str) -> String {
    let file_path = temp_dir.path().join(name);
    std::fs::write(&file_path, format!("fake audio data for {}", name)).unwrap();
    file_path.to_string_lossy().to_string()
}

/// Helper to create a FileToSave with common defaults.
fn create_file_to_save(
    source_path: String,
    title: &str,
    artist: &str,
    album: &str,
    year: i32,
    track: u32,
) -> FileToSave {
    FileToSave {
        source_path,
        metadata: AudioMetadata {
            title: Some(title.to_string()),
            artist: Some(artist.to_string()),
            album: Some(album.to_string()),
            year: Some(year),
            track_number: Some(track),
            duration_secs: Some(180),
            release_mbid: None,
        },
    }
}

// =============================================================================
// String Deduplication Tests
// =============================================================================

#[test]
fn test_string_deduplication_across_batches() {
    let (temp_dir, base_path) = setup_test_library();

    // First batch: add one song
    let file1 = create_dummy_audio_file(&temp_dir, "test1.mp3");
    let files1 = vec![create_file_to_save(
        file1,
        "Song One",
        "Test Artist",
        "Test Album",
        2020,
        1,
    )];

    let result1 = save_to_library(base_path.clone(), files1).unwrap();
    assert_eq!(result1.files_saved, 1);
    assert_eq!(result1.artists_added, 1);
    assert_eq!(result1.albums_added, 1);

    // Second batch: add another song with SAME artist and album
    let file2 = create_dummy_audio_file(&temp_dir, "test2.mp3");
    let files2 = vec![create_file_to_save(
        file2,
        "Song Two",
        "Test Artist", // Same artist
        "Test Album",  // Same album
        2020,
        2,
    )];

    let result2 = save_to_library(base_path.clone(), files2).unwrap();

    // Should reuse existing artist/album, not create duplicates
    assert_eq!(result2.artists_added, 0, "Should add 0 new artists");
    assert_eq!(result2.albums_added, 0, "Should add 0 new albums");

    // Verify library state
    let library = load_library(base_path).unwrap();
    assert_eq!(library.songs.len(), 2, "Should have 2 songs");
    assert_eq!(
        library.artists.len(),
        1,
        "Should have 1 artist (deduplicated)"
    );
    assert_eq!(
        library.albums.len(),
        1,
        "Should have 1 album (deduplicated)"
    );
}

// =============================================================================
// Duplicate Song Detection Tests
// =============================================================================

#[test]
fn test_duplicate_song_detection_across_batches() {
    let (temp_dir, base_path) = setup_test_library();

    // First save: add a song
    let file1 = create_dummy_audio_file(&temp_dir, "test1.mp3");
    let files1 = vec![create_file_to_save(
        file1,
        "Unique Song",
        "Test Artist",
        "Test Album",
        2020,
        1,
    )];

    let result1 = save_to_library(base_path.clone(), files1).unwrap();
    assert_eq!(result1.files_saved, 1, "First save should save 1 file");
    assert_eq!(result1.songs_added, 1, "First save should add 1 song");
    assert_eq!(
        result1.duplicates_skipped, 0,
        "First save should skip 0 duplicates"
    );

    // Second save: try to add the SAME song (same title/artist/album)
    let file2 = create_dummy_audio_file(&temp_dir, "test2.mp3");
    let files2 = vec![create_file_to_save(
        file2,
        "Unique Song", // Same title
        "Test Artist", // Same artist
        "Test Album",  // Same album
        2020,
        1,
    )];

    let result2 = save_to_library(base_path.clone(), files2).unwrap();
    assert_eq!(
        result2.files_saved, 0,
        "Second save should save 0 files (duplicate)"
    );
    assert_eq!(
        result2.songs_added, 0,
        "Second save should add 0 songs (duplicate)"
    );
    assert_eq!(
        result2.duplicates_skipped, 1,
        "Second save should skip 1 duplicate"
    );

    // Verify library still has only 1 song
    let library = load_library(base_path.clone()).unwrap();
    assert_eq!(library.songs.len(), 1, "Library should have exactly 1 song");

    // Verify only 1 file in music directory
    let music_path = temp_dir.path().join("jp3/music/00");
    let file_count = std::fs::read_dir(&music_path)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .count();
    assert_eq!(file_count, 1, "Music directory should have exactly 1 file");
}

#[test]
fn test_duplicate_detection_within_same_batch() {
    let (temp_dir, base_path) = setup_test_library();

    // Try to add the same song twice in ONE batch
    let file1 = create_dummy_audio_file(&temp_dir, "test1.mp3");
    let file2 = create_dummy_audio_file(&temp_dir, "test2.mp3");

    let files = vec![
        create_file_to_save(file1, "Same Song", "Same Artist", "Same Album", 2020, 1),
        create_file_to_save(file2, "Same Song", "Same Artist", "Same Album", 2020, 2), // Duplicate!
    ];

    let result = save_to_library(base_path.clone(), files).unwrap();
    assert_eq!(result.files_saved, 1, "Should save 1 file");
    assert_eq!(result.songs_added, 1, "Should add 1 song");
    assert_eq!(
        result.duplicates_skipped, 1,
        "Should skip 1 duplicate in batch"
    );

    // Verify library has only 1 song
    let library = load_library(base_path).unwrap();
    assert_eq!(library.songs.len(), 1, "Library should have exactly 1 song");
}

// =============================================================================
// Soft Delete Tests
// =============================================================================

#[test]
fn test_soft_delete_songs() {
    let (temp_dir, base_path) = setup_test_library();

    // Add two songs
    let file1 = create_dummy_audio_file(&temp_dir, "test1.mp3");
    let file2 = create_dummy_audio_file(&temp_dir, "test2.mp3");

    let files = vec![
        create_file_to_save(file1, "Song One", "Artist", "Album", 2020, 1),
        create_file_to_save(file2, "Song Two", "Artist", "Album", 2020, 2),
    ];

    save_to_library(base_path.clone(), files).unwrap();

    // Verify we have 2 songs
    let library = load_library(base_path.clone()).unwrap();
    assert_eq!(library.songs.len(), 2, "Should have 2 songs before delete");

    // Verify audio files exist before delete
    let music_path = temp_dir.path().join("jp3/music");
    let audio_file_1 = music_path.join("00/001.mp3");
    let audio_file_2 = music_path.join("00/002.mp3");
    assert!(
        audio_file_1.exists(),
        "Audio file 1 should exist before delete"
    );
    assert!(
        audio_file_2.exists(),
        "Audio file 2 should exist before delete"
    );

    // Delete song 0
    let delete_result = delete_songs(base_path.clone(), vec![0]).unwrap();
    assert_eq!(delete_result.songs_deleted, 1, "Should delete 1 song");
    assert_eq!(delete_result.files_deleted, 1, "Should delete 1 audio file");
    assert!(
        delete_result.not_found.is_empty(),
        "Should not have any not_found"
    );

    // Verify audio file was deleted
    assert!(!audio_file_1.exists(), "Audio file 1 should be deleted");
    assert!(audio_file_2.exists(), "Audio file 2 should still exist");

    // Verify we now have 1 song (deleted one is filtered out)
    let library = load_library(base_path.clone()).unwrap();
    assert_eq!(library.songs.len(), 1, "Should have 1 song after delete");
    assert_eq!(
        library.songs[0].title, "Song Two",
        "Remaining song should be Song Two"
    );

    // Check stats show 1 deleted
    let stats = get_library_stats(base_path).unwrap();
    assert_eq!(stats.total_songs, 2, "Total songs should still be 2");
    assert_eq!(stats.active_songs, 1, "Active songs should be 1");
    assert_eq!(stats.deleted_songs, 1, "Deleted songs should be 1");
}

#[test]
fn test_delete_nonexistent_song() {
    let (temp_dir, base_path) = setup_test_library();

    // Add one song
    let file = create_dummy_audio_file(&temp_dir, "test.mp3");
    let files = vec![create_file_to_save(
        file, "Song One", "Artist", "Album", 2020, 1,
    )];
    save_to_library(base_path.clone(), files).unwrap();

    // Try to delete nonexistent song IDs
    let delete_result = delete_songs(base_path, vec![5, 10, 100]).unwrap();
    assert_eq!(delete_result.songs_deleted, 0, "Should delete 0 songs");
    assert_eq!(delete_result.not_found.len(), 3, "Should have 3 not_found");
}

// =============================================================================
// Edit Metadata Tests
// =============================================================================

#[test]
fn test_edit_song_metadata() {
    let (temp_dir, base_path) = setup_test_library();

    // Add one song with incorrect metadata
    let file = create_dummy_audio_file(&temp_dir, "test.mp3");
    let files = vec![create_file_to_save(
        file,
        "Wrong Title",
        "Wrong Artist",
        "Wrong Album",
        2020,
        1,
    )];
    save_to_library(base_path.clone(), files).unwrap();

    // Edit the song with correct metadata
    let new_metadata = AudioMetadata {
        title: Some("Correct Title".to_string()),
        artist: Some("Correct Artist".to_string()),
        album: Some("Correct Album".to_string()),
        year: Some(2021),
        track_number: Some(1),
        duration_secs: Some(180),
        release_mbid: None,
    };

    let edit_result = edit_song_metadata(base_path.clone(), 0, new_metadata).unwrap();

    assert!(edit_result.artist_created, "Should create new artist");
    assert!(edit_result.album_created, "Should create new album");

    // Verify the library now shows the corrected metadata
    let library = load_library(base_path.clone()).unwrap();
    assert_eq!(library.songs.len(), 1, "Should have 1 active song");
    assert_eq!(library.songs[0].title, "Correct Title");
    assert_eq!(library.songs[0].artist_name, "Correct Artist");
    assert_eq!(library.songs[0].album_name, "Correct Album");

    // Stats should show the old one as deleted
    let stats = get_library_stats(base_path).unwrap();
    assert_eq!(stats.total_songs, 2, "Total songs should be 2 (old + new)");
    assert_eq!(stats.active_songs, 1, "Active songs should be 1");
    assert_eq!(stats.deleted_songs, 1, "Deleted songs should be 1");
}

// =============================================================================
// Compaction Tests
// =============================================================================

#[test]
fn test_compact_library() {
    let (temp_dir, base_path) = setup_test_library();

    // Add three songs with different artists/albums
    let file1 = create_dummy_audio_file(&temp_dir, "test1.mp3");
    let file2 = create_dummy_audio_file(&temp_dir, "test2.mp3");
    let file3 = create_dummy_audio_file(&temp_dir, "test3.mp3");

    let files = vec![
        create_file_to_save(file1, "Song One", "Artist One", "Album One", 2020, 1),
        create_file_to_save(file2, "Song Two", "Artist Two", "Album Two", 2021, 1),
        create_file_to_save(file3, "Song Three", "Artist One", "Album One", 2020, 2), // Same as song 1
    ];

    save_to_library(base_path.clone(), files).unwrap();

    // Verify initial state
    let stats_before = get_library_stats(base_path.clone()).unwrap();
    assert_eq!(stats_before.total_artists, 2, "Should have 2 artists");
    assert_eq!(stats_before.total_albums, 2, "Should have 2 albums");

    // Delete song 1 (Song Two with Artist Two / Album Two)
    delete_songs(base_path.clone(), vec![1]).unwrap();

    // Check stats before compaction
    let stats_deleted = get_library_stats(base_path.clone()).unwrap();
    assert_eq!(stats_deleted.deleted_songs, 1);
    assert_eq!(
        stats_deleted.total_artists, 2,
        "Artists still 2 before compact"
    );

    // Compact
    let compact_result = compact_library(base_path.clone()).unwrap();

    assert_eq!(compact_result.songs_removed, 1, "Should remove 1 song");
    assert_eq!(
        compact_result.artists_removed, 1,
        "Should remove orphaned Artist Two"
    );
    assert_eq!(
        compact_result.albums_removed, 1,
        "Should remove orphaned Album Two"
    );
    assert!(compact_result.bytes_saved > 0, "Should save some bytes");

    // Verify final state
    let stats_after = get_library_stats(base_path.clone()).unwrap();
    assert_eq!(stats_after.total_songs, 2, "Should have 2 songs");
    assert_eq!(stats_after.deleted_songs, 0, "Should have 0 deleted");
    assert_eq!(stats_after.total_artists, 1, "Should have 1 artist");
    assert_eq!(stats_after.total_albums, 1, "Should have 1 album");

    // Verify the remaining songs are correct
    let library = load_library(base_path).unwrap();
    assert_eq!(library.songs.len(), 2);
    let titles: Vec<_> = library.songs.iter().map(|s| s.title.as_str()).collect();
    assert!(titles.contains(&"Song One"));
    assert!(titles.contains(&"Song Three"));
    assert!(!titles.contains(&"Song Two")); // This was deleted
}

// =============================================================================
// Edit with Playlist Remapping Tests
// =============================================================================

#[test]
fn test_edit_song_remaps_playlist_ids() {
    let (temp_dir, base_path) = setup_test_library();

    // Add three songs
    let file1 = create_dummy_audio_file(&temp_dir, "song1.mp3");
    let file2 = create_dummy_audio_file(&temp_dir, "song2.mp3");
    let file3 = create_dummy_audio_file(&temp_dir, "song3.mp3");

    let files = vec![
        create_file_to_save(file1, "Song One", "Artist", "Album", 2020, 1),
        create_file_to_save(file2, "Song Two", "Artist", "Album", 2020, 2),
        create_file_to_save(file3, "Song Three", "Artist", "Album", 2020, 3),
    ];

    let save_result = save_to_library(base_path.clone(), files).unwrap();
    assert_eq!(save_result.songs_added, 3);

    // Create a playlist with songs [0, 1, 2]
    let playlist_result =
        create_playlist(base_path.clone(), "My Playlist".to_string(), vec![0, 1, 2]).unwrap();
    let playlist_id = playlist_result.playlist_id;

    // Verify playlist has [0, 1, 2]
    let playlist_before = load_playlist(base_path.clone(), playlist_id).unwrap();
    assert_eq!(playlist_before.song_ids, vec![0, 1, 2]);

    // Edit song 1 (Song Two) - this should create a new song ID (3) and remap playlist
    let new_metadata = AudioMetadata {
        title: Some("Song Two (Edited)".to_string()),
        artist: Some("Artist".to_string()),
        album: Some("Album".to_string()),
        year: Some(2020),
        track_number: Some(2),
        duration_secs: Some(180),
        release_mbid: None,
    };

    let edit_result = edit_song_metadata(base_path.clone(), 1, new_metadata).unwrap();

    // Should have created new song ID 3
    assert_eq!(edit_result.new_song_id, 3, "New song should have ID 3");
    // Should have updated 1 playlist
    assert_eq!(edit_result.playlists_updated, 1, "Should update 1 playlist");

    // Verify playlist now has [0, 3, 2] (1 replaced with 3)
    let playlist_after = load_playlist(base_path.clone(), playlist_id).unwrap();
    assert_eq!(
        playlist_after.song_ids,
        vec![0, 3, 2],
        "Playlist should have remapped ID 1 to 3"
    );

    // Verify the library shows the edited song
    let library = load_library(base_path).unwrap();
    assert_eq!(library.songs.len(), 3, "Should have 3 active songs");

    let edited_song = library
        .songs
        .iter()
        .find(|s| s.id == 3)
        .expect("Should find song with ID 3");
    assert_eq!(edited_song.title, "Song Two (Edited)");
}

#[test]
fn test_edit_song_no_playlists_affected() {
    let (temp_dir, base_path) = setup_test_library();

    // Add a song
    let file = create_dummy_audio_file(&temp_dir, "test.mp3");
    let files = vec![create_file_to_save(
        file,
        "Test Song",
        "Artist",
        "Album",
        2020,
        1,
    )];
    save_to_library(base_path.clone(), files).unwrap();

    // Create a playlist with song ID 0
    create_playlist(base_path.clone(), "Playlist".to_string(), vec![0]).unwrap();

    // Add another song (ID 1)
    let file2 = create_dummy_audio_file(&temp_dir, "test2.mp3");
    let files2 = vec![create_file_to_save(
        file2,
        "Another Song",
        "Artist",
        "Album",
        2020,
        2,
    )];
    save_to_library(base_path.clone(), files2).unwrap();

    // Edit song 1 (not in any playlist)
    let new_metadata = AudioMetadata {
        title: Some("Another Song (Edited)".to_string()),
        artist: Some("Artist".to_string()),
        album: Some("Album".to_string()),
        year: Some(2020),
        track_number: Some(2),
        duration_secs: Some(180),
        release_mbid: None,
    };

    let edit_result = edit_song_metadata(base_path, 1, new_metadata).unwrap();

    // No playlists should be updated
    assert_eq!(
        edit_result.playlists_updated, 0,
        "No playlists should be updated"
    );
}
