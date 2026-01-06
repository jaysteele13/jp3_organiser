/**
 * Library Service
 * 
 * Wraps Tauri commands for managing the JP3 library configuration.
 * This includes the base library path where all music files, metadata,
 * and playlists will be stored.
 * 
 * Directory Structure:
 * {libraryPath}/
 *   jp3/
 *     music/
 *       00/  (buckets, max 256 songs each)
 *       01/
 *       ...
 *     metadata/
 *       library.bin  (binary format for ESP32)
 *     playlists/
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Get the saved library path from persistent storage
 * @returns {Promise<string|null>} The library path or null if not set
 */
export async function getLibraryPath() {
  return await invoke('get_library_path');
}

/**
 * Save the library path to persistent storage
 * Validates that the path exists and is a directory
 * @param {string} path - The directory path to save
 * @throws {Error} If path doesn't exist or is not a directory
 */
export async function setLibraryPath(path) {
  return await invoke('set_library_path', { path });
}

/**
 * Clear the library path from persistent storage
 */
export async function clearLibraryPath() {
  return await invoke('clear_library_path');
}

/**
 * Initialize the JP3 library directory structure
 * Creates: jp3/music/00/, jp3/metadata/, jp3/playlists/
 * Also creates an empty library.bin file
 * 
 * @param {string} basePath - The base directory path
 * @returns {Promise<string>} The full path to the jp3 directory
 */
export async function initializeLibrary(basePath) {
  return await invoke('initialize_library', { basePath });
}

/**
 * Get information about the current library structure
 * 
 * @param {string} basePath - The base directory path
 * @returns {Promise<LibraryInfo>} Information about the library
 * 
 * @typedef {Object} LibraryInfo
 * @property {boolean} initialized - Whether the jp3 directory exists
 * @property {string|null} jp3Path - Full path to jp3 directory
 * @property {number} musicBuckets - Number of music bucket folders
 * @property {boolean} hasLibraryBin - Whether library.bin exists
 */
export async function getLibraryInfo(basePath) {
  return await invoke('get_library_info', { basePath });
}

/**
 * Save audio files to the library.
 * 
 * Copies files to music buckets and builds library.bin with
 * deduped artists, albums, and songs.
 * 
 * @param {string} basePath - The base library directory path
 * @param {FileToSave[]} files - Files to save with their metadata
 * @returns {Promise<SaveToLibraryResult>} Result with counts
 * 
 * @typedef {Object} FileToSave
 * @property {string} sourcePath - Original file path
 * @property {Object} metadata - Metadata object with title, artist, album, etc.
 * 
 * @typedef {Object} SaveToLibraryResult
 * @property {number} filesSaved - Number of files copied
 * @property {number} artistsAdded - Number of artists in library
 * @property {number} albumsAdded - Number of albums in library
 * @property {number} songsAdded - Number of songs in library
 */
export async function saveToLibrary(basePath, files) {
  return await invoke('save_to_library', { basePath, files });
}

/**
 * Load and parse the library.bin file from the jp3 folder.
 * 
 * This reads directly from the file on disk, parsing it
 * exactly as the ESP32 would (not from locally cached memory).
 * 
 * @param {string} basePath - The base library directory path
 * @returns {Promise<ParsedLibrary>} Parsed library data
 * 
 * @typedef {Object} ParsedArtist
 * @property {number} id - Artist ID
 * @property {string} name - Artist name
 * 
 * @typedef {Object} ParsedAlbum
 * @property {number} id - Album ID
 * @property {string} name - Album name
 * @property {number} artistId - Artist ID
 * @property {string} artistName - Artist name (resolved)
 * @property {number} year - Release year
 * 
 * @typedef {Object} ParsedSong
 * @property {number} id - Song ID
 * @property {string} title - Song title
 * @property {number} artistId - Artist ID
 * @property {string} artistName - Artist name (resolved)
 * @property {number} albumId - Album ID
 * @property {string} albumName - Album name (resolved)
 * @property {string} path - Relative path in library (e.g., "00/001.mp3")
 * @property {number} trackNumber - Track number
 * @property {number} durationSec - Duration in seconds
 * 
 * @typedef {Object} ParsedLibrary
 * @property {number} version - Library format version
 * @property {ParsedArtist[]} artists - All artists
 * @property {ParsedAlbum[]} albums - All albums
 * @property {ParsedSong[]} songs - All songs
 */
export async function loadLibrary(basePath) {
  return await invoke('load_library', { basePath });
}

/**
 * Soft delete songs by their IDs.
 * 
 * This marks the song as deleted in library.bin (minimal binary write) AND
 * deletes the actual audio file from music/ (frees disk space immediately).
 * Use `compactLibrary` to reclaim metadata space in library.bin.
 * 
 * @param {string} basePath - The base library directory path
 * @param {number[]} songIds - Array of song IDs to delete
 * @returns {Promise<DeleteSongsResult>} Result with deletion counts
 * 
 * @typedef {Object} DeleteSongsResult
 * @property {number} songsDeleted - Number of songs successfully marked as deleted
 * @property {number[]} notFound - Song IDs that were not found
 * @property {number} filesDeleted - Number of audio files deleted from music/
 */
export async function deleteSongs(basePath, songIds) {
  return await invoke('delete_songs', { basePath, songIds });
}

/**
 * Get library statistics including deleted song count.
 * 
 * Use this to determine if compaction is needed.
 * 
 * @param {string} basePath - The base library directory path
 * @returns {Promise<LibraryStats>} Library statistics
 * 
 * @typedef {Object} LibraryStats
 * @property {number} totalSongs - Total songs (including deleted)
 * @property {number} activeSongs - Active songs (not deleted)
 * @property {number} deletedSongs - Deleted songs
 * @property {number} totalArtists - Total artists
 * @property {number} totalAlbums - Total albums
 * @property {number} totalStrings - Total strings in string table
 * @property {number} deletedPercentage - Percentage of deleted songs (0-100)
 * @property {boolean} shouldCompact - Recommended to compact (deleted > 20%)
 * @property {number} fileSizeBytes - File size in bytes
 */
export async function getLibraryStats(basePath) {
  return await invoke('get_library_stats', { basePath });
}

/**
 * Compact the library by removing deleted entries and orphaned data.
 * 
 * This rebuilds the entire library.bin, removing:
 * - Soft-deleted songs
 * - Artists with no remaining songs
 * - Albums with no remaining songs
 * - Strings not referenced by any active entry
 * 
 * This is a full rewrite operation - use sparingly to minimize SD card wear.
 * 
 * @param {string} basePath - The base library directory path
 * @returns {Promise<CompactResult>} Result with removal counts
 * 
 * @typedef {Object} CompactResult
 * @property {number} songsRemoved - Songs removed (were soft-deleted)
 * @property {number} artistsRemoved - Orphaned artists removed
 * @property {number} albumsRemoved - Orphaned albums removed
 * @property {number} stringsRemoved - Orphaned strings removed
 * @property {number} oldSizeBytes - Old file size
 * @property {number} newSizeBytes - New file size
 * @property {number} bytesSaved - Bytes saved
 */
export async function compactLibrary(basePath) {
  return await invoke('compact_library', { basePath });
}

// =============================================================================
// Playlist Functions
// =============================================================================

/**
 * Create a new playlist with the given song IDs.
 * 
 * Songs must already exist in library.bin.
 * 
 * @param {string} basePath - The base library directory path
 * @param {string} name - Playlist name
 * @param {number[]} songIds - Array of song IDs to include
 * @returns {Promise<CreatePlaylistResult>} Result with playlist ID
 * 
 * @typedef {Object} CreatePlaylistResult
 * @property {number} playlistId - The created playlist's ID
 * @property {number} songsAdded - Number of songs added
 */
export async function createPlaylist(basePath, name, songIds) {
  return await invoke('create_playlist', { basePath, name, songIds });
}

/**
 * Load a single playlist by ID.
 * 
 * @param {string} basePath - The base library directory path
 * @param {number} playlistId - Playlist ID to load
 * @returns {Promise<ParsedPlaylist>} Parsed playlist data
 * 
 * @typedef {Object} ParsedPlaylist
 * @property {number} id - Playlist ID
 * @property {string} name - Playlist name
 * @property {number} songCount - Number of songs
 * @property {number[]} songIds - Array of song IDs
 */
export async function loadPlaylist(basePath, playlistId) {
  return await invoke('load_playlist', { basePath, playlistId });
}

/**
 * List all playlists (summaries only).
 * 
 * @param {string} basePath - The base library directory path
 * @returns {Promise<PlaylistSummary[]>} Array of playlist summaries
 * 
 * @typedef {Object} PlaylistSummary
 * @property {number} id - Playlist ID
 * @property {string} name - Playlist name
 * @property {number} songCount - Number of songs
 */
export async function listPlaylists(basePath) {
  return await invoke('list_playlists', { basePath });
}

/**
 * Delete a playlist by name.
 * 
 * Searches all playlist files to find one with the matching name and deletes it.
 * 
 * @param {string} basePath - The base library directory path
 * @param {string} playlistName - Playlist name to delete
 * @returns {Promise<DeletePlaylistResult>} Result indicating if deleted
 * 
 * @typedef {Object} DeletePlaylistResult
 * @property {boolean} deleted - Whether the playlist was deleted
 */
export async function deletePlaylistByName(basePath, playlistName) {
  return await invoke('delete_playlist_by_name', { basePath, playlistName });
}

/**
 * Save audio files to library AND create a playlist with them.
 * 
 * This is the combined operation for "Add Playlist" mode:
 * 1. First saves all songs to library.bin
 * 2. Then creates a playlist with the song IDs
 * 
 * @param {string} basePath - The base library directory path
 * @param {string} playlistName - Name for the new playlist
 * @param {FileToSave[]} files - Files to save with their metadata
 * @returns {Promise<SaveToPlaylistResult>} Result with counts and playlist info
 * 
 * @typedef {Object} SaveToPlaylistResult
 * @property {number} filesSaved - Number of files copied
 * @property {number} artistsAdded - Number of artists in library
 * @property {number} albumsAdded - Number of albums in library
 * @property {number} songsAdded - Number of songs in library
 * @property {number} duplicatesSkipped - Number of duplicate songs skipped
 * @property {number} playlistId - The created playlist's ID
 * @property {string} playlistName - The playlist name
 */
export async function saveToPlaylist(basePath, playlistName, files) {
  return await invoke('save_to_playlist', { basePath, playlistName, files });
}

/**
 * Add songs to an existing playlist.
 * 
 * @param {string} basePath - The base library directory path
 * @param {number} playlistId - Playlist ID to modify
 * @param {number[]} songIds - Song IDs to add
 * @returns {Promise<CreatePlaylistResult>} Result with count of songs added
 */
export async function addSongsToPlaylist(basePath, playlistId, songIds) {
  return await invoke('add_songs_to_playlist', { basePath, playlistId, songIds });
}

/**
 * Remove songs from an existing playlist.
 * 
 * @param {string} basePath - The base library directory path
 * @param {number} playlistId - Playlist ID to modify
 * @param {number[]} songIds - Song IDs to remove
 * @returns {Promise<CreatePlaylistResult>} Result with count of songs removed
 */
export async function removeSongsFromPlaylist(basePath, playlistId, songIds) {
  return await invoke('remove_songs_from_playlist', { basePath, playlistId, songIds });
}
