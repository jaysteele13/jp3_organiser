/**
 * Cover Art Service
 * 
 * Wraps Tauri commands for fetching and managing album and artist cover art.
 * 
 * Album covers are fetched from Cover Art Archive using MusicBrainz Release IDs (MBIDs).
 * Artist covers are fetched from Deezer API by searching the artist name (no API key required).
 * 
 * Cover files are cached locally in the jp3/assets/ directory:
 * - Album covers: jp3/assets/albums/{hash}.jpg
 * - Artist covers: jp3/assets/artists/{hash}.jpg
 * 
 * Hash is based on "artist|||album" for albums, "artist|||artist" for artists.
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
 * If the primary MBID returns no cover art and a fallback MBID is provided,
 * the backend will retry with the fallback (typically the AcoustID release MBID).
 * Cover files are named using a hash of artist+album for stability.
 * 
 * @param {string} basePath - Library base path
 * @param {string} artist - Artist name (for stable filename generation)
 * @param {string} album - Album name (for stable filename generation)
 * @param {string} mbid - Primary MusicBrainz Release ID
 * @param {string|null} [fallbackMbid=null] - Optional AcoustID Release ID (fallback)
 * @returns {Promise<{success: boolean, path?: string, error?: string, wasCached: boolean}>}
 */
export async function fetchAlbumCover(basePath, artist, album, mbid, fallbackMbid = null) {
  return await invoke('fetch_album_cover', { basePath, artist, album, mbid, fallbackMbid });
}

/**
 * Fetch album cover from Deezer as a fallback
 * 
 * Used when CoverArtArchive is unavailable (5xx gateway errors).
 * Searches Deezer by artist + album name — no MBID required.
 * 
 * @param {string} basePath - Library base path
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<{success: boolean, path?: string, error?: string, wasCached: boolean}>}
 */
export async function fetchDeezerAlbumCover(basePath, artist, album) {
  return await invoke('fetch_deezer_album_cover', { basePath, artist, album });
}

/**
 * Fetch and cache cover art for an artist
 * 
 * If cover already exists in cache, returns the cached path immediately.
 * Otherwise, fetches from Deezer API by searching the artist name.
 * No MBID or API key required.
 * Cover files are named using a hash of artist name for stability.
 * 
 * @param {string} basePath - Library base path
 * @param {string} artist - Artist name (used for search and stable filename generation)
 * @returns {Promise<{success: boolean, path?: string, error?: string, wasCached: boolean}>}
 */
export async function fetchArtistCover(basePath, artist) {
  return await invoke('fetch_artist_cover', { basePath, artist });
}

/**
 * Read album cover image bytes for displaying in frontend
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
 * Read artist cover image bytes for displaying in frontend
 * 
 * Useful when you need raw image data for blob URLs.
 * Returns the image as a Uint8Array.
 * Uses artist hash for stable filename lookup.
 * 
 * @param {string} basePath - Library base path
 * @param {string} artist - Artist name
 * @returns {Promise<Uint8Array>} Image bytes
 * @throws {Error} If cover not found
 */
export async function readArtistCover(basePath, artist) {
  return await invoke('read_artist_cover', { basePath, artist }); 
}

/**
 * Create a blob URL from album cover image bytes
 * 
 * Helper function that reads cover bytes and creates an object URL
 * for use in img src attributes.
 * 
 * @param {string} basePath - Library base path
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<string|null>} Blob URL or null if cover not found
 */
export async function getAlbumCoverBlobUrl(basePath, artist, album) {
  try {
    const bytes = await readAlbumCover(basePath, artist, album);
    return bytesToBlobUrl(bytes);
  } catch {
    // Cover not found or read error - this is expected for albums without covers
    return null;
  }
}

/**
 * Create a blob URL from artist cover image bytes
 * 
 * Helper function that reads cover bytes and creates an object URL
 * for use in img src attributes.
 * 
 * @param {string} basePath - Library base path
 * @param {string} artist - Artist name
 * @returns {Promise<string|null>} Blob URL or null if cover not found
 */
export async function getArtistCoverBlobUrl(basePath, artist) {
  try {
    const bytes = await readArtistCover(basePath, artist);
    return bytesToBlobUrl(bytes);
  } catch {
    // Cover not found or read error - this is expected for artists without covers
    return null;
  }
}

/**
 * Convert raw bytes to a blob URL
 * @param {Uint8Array|number[]} bytes - Image bytes
 * @returns {string|null} Blob URL or null if conversion fails
 */
function bytesToBlobUrl(bytes) {
  // Tauri returns an array of numbers, need to convert to Uint8Array
  let uint8Array;
  if (bytes instanceof Uint8Array) {
    uint8Array = bytes;
  } else if (Array.isArray(bytes)) {
    uint8Array = new Uint8Array(bytes);
  } else {
    console.log('[coverArtService] Unexpected bytes type:', typeof bytes);
    return null;
  }
  
  const blob = new Blob([uint8Array], { type: 'image/jpeg' });
  return URL.createObjectURL(blob);
}

/**
 * Clear all cached cover art for albums and artists.
 * 
 * Removes all cached .jpg files from the jp3/assets/albums/ and jp3/assets/artists/ directories.
 * The directories are preserved (only files are deleted).
 * 
 * @param {string} basePath - Library base path
 * @returns {Promise<{success: boolean, albumsCleared: number, artistsCleared: number, error?: string}>}
 */
export async function clearCoverCache(basePath) {
  return await invoke('clear_cover_cache', { basePath });
}
