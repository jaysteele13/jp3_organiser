/**
 * Cover Art Service
 * 
 * Wraps Tauri commands for fetching and managing album cover art.
 * Cover art is fetched from Cover Art Archive using MusicBrainz Release IDs (MBIDs)
 * and cached locally in the jp3/covers/ directory.
 * 
 * Directory Structure:
 * {libraryPath}/
 *   jp3/
 *     covers/
 *       {albumId}.jpg  (cached cover images)
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Fetch and cache cover art for an album
 * 
 * If cover already exists in cache, returns the cached path immediately.
 * Otherwise, fetches from Cover Art Archive using the MBID and caches it.
 * 
 * @param {string} basePath - Library base path
 * @param {number} albumId - Album ID for the filename
 * @param {string} mbid - MusicBrainz Release ID
 * @returns {Promise<{success: boolean, path?: string, error?: string, wasCached: boolean}>}
 */
export async function fetchAlbumCover(basePath, albumId, mbid) {
  return await invoke('fetch_album_cover', { basePath, albumId, mbid });
}

/**
 * Read cover image bytes for displaying in frontend
 * 
 * Useful when you need raw image data for blob URLs.
 * Returns the image as a Uint8Array.
 * 
 * @param {string} basePath - Library base path
 * @param {number} albumId - Album ID
 * @returns {Promise<Uint8Array>} Image bytes
 * @throws {Error} If cover not found
 */
export async function readAlbumCover(basePath, albumId) {
  return await invoke('read_album_cover', { basePath, albumId });
}

/**
 * Create a blob URL from cover image bytes
 * 
 * Helper function that reads cover bytes and creates an object URL
 * for use in img src attributes.
 * 
 * @param {string} basePath - Library base path
 * @param {number} albumId - Album ID
 * @returns {Promise<string|null>} Blob URL or null if cover not found
 */
export async function getCoverBlobUrl(basePath, albumId) {
  try {
    const bytes = await readAlbumCover(basePath, albumId);
    
    // Tauri returns an array of numbers, need to convert to Uint8Array
    let uint8Array;
    if (bytes instanceof Uint8Array) {
      uint8Array = bytes;
    } else if (Array.isArray(bytes)) {
      uint8Array = new Uint8Array(bytes);
    } else {
      return null;
    }
    
    const blob = new Blob([uint8Array], { type: 'image/jpeg' });
    return URL.createObjectURL(blob);
  } catch {
    // Cover not found or read error - this is expected for albums without covers
    return null;
  }
}
