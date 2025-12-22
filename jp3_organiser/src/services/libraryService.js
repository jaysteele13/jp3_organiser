/**
 * Library Service
 * 
 * Wraps Tauri commands for managing the JP3 library configuration.
 * This includes the base library path where all music files, metadata,
 * and playlists will be stored.
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
