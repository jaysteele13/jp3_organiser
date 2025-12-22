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
