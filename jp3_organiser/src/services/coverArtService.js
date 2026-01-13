/**
 * Cover Art Service
 * 
 * Wraps Tauri commands for fetching and managing album cover art.
 * Cover art is fetched from Cover Art Archive using MusicBrainz Release IDs (MBIDs)
 * and cached locally in the jp3/covers/ directory.
 * 
 * Cover files are named using a hash of "artist|||album" for stability
 * across library compaction operations.
 * 
 * Directory Structure:
 * {libraryPath}/
 *   jp3/
 *     covers/
 *       {hash}.jpg  (cached cover images, hash based on artist+album)
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Search for a release MBID using MusicBrainz API
 * 
 * This searches the MusicBrainz database by artist and album name,
 * returning the best matching release MBID for use with Cover Art Archive.
 * 
 * More accurate than AcoustID's MBID because it uses user-confirmed metadata.
 * 
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<{found: boolean, mbid?: string, title?: string, artist?: string, score?: number}>}
 */
export async function searchAlbumMbid(artist, album) {
  return await invoke('search_album_mbid', { artist, album });
}

/**
 * Batch search for multiple release MBIDs
 * 
 * More efficient than calling searchAlbumMbid multiple times as it
 * manages rate limiting internally.
 * 
 * @param {Array<{artist: string, album: string}>} queries - Albums to search
 * @returns {Promise<Array<{found: boolean, mbid?: string, title?: string, artist?: string, score?: number}>>}
 */
export async function searchAlbumMbidsBatch(queries) {
  return await invoke('search_album_mbids_batch', { queries });
}

/**
 * Fetch and cache cover art for an album
 * 
 * If cover already exists in cache, returns the cached path immediately.
 * Otherwise, fetches from Cover Art Archive using the MBID and caches it.
 * Cover files are named using a hash of artist+album for stability.
 * 
 * @param {string} basePath - Library base path
 * @param {string} artist - Artist name (for stable filename generation)
 * @param {string} album - Album name (for stable filename generation)
 * @param {string} mbid - MusicBrainz Release ID
 * @returns {Promise<{success: boolean, path?: string, error?: string, wasCached: boolean}>}
 */
export async function fetchAlbumCover(basePath, artist, album, mbid) {
  return await invoke('fetch_album_cover', { basePath, artist, album, mbid });
}

/**
 * Read cover image bytes for displaying in frontend
 * 
 * Useful when you need raw image data for blob URLs.
 * Returns the image as a Uint8Array.
 * Uses artist+album hash for stable filename lookup.
 * 
 * @param {string} basePath - Library base path
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<Uint8Array>} Image bytes
 * @throws {Error} If cover not found
 */
export async function readAlbumCover(basePath, artist, album) {
  return await invoke('read_album_cover', { basePath, artist, album });
}

/**
 * Create a blob URL from cover image bytes
 * 
 * Helper function that reads cover bytes and creates an object URL
 * for use in img src attributes.
 * Uses artist+album hash for stable filename lookup.
 * 
 * @param {string} basePath - Library base path
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<string|null>} Blob URL or null if cover not found
 */
export async function getCoverBlobUrl(basePath, artist, album) {
  try {
    const bytes = await readAlbumCover(basePath, artist, album);
    
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
