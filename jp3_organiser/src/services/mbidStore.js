/**
 * MBID Store Service
 * 
 * Stores MusicBrainz Release IDs (MBIDs) for albums using tauri-plugin-store.
 * Used to fetch cover art from Cover Art Archive.
 * 
 * Storage format:
 * {
 *   albumMbids: {
 *     "artist|||album": string (mbid)
 *   }
 * }
 * 
 * Note: MBIDs are keyed by "artist|||album" string to:
 * - Survive album deletion and re-add cycles (IDs get reused)
 * - Match how we search MusicBrainz (by artist + album name)
 * - Provide stable keys based on actual album identity
 */

import { load } from '@tauri-apps/plugin-store';

const STORE_NAME = 'mbids.json';
const MBIDS_KEY = 'albumMbids';
const KEY_SEPARATOR = '|||';

let storeInstance = null;

/**
 * Get or create the store instance
 * @returns {Promise<Store>}
 */
async function getStore() {
  if (!storeInstance) {
    storeInstance = await load(STORE_NAME, { autoSave: true });
  }
  return storeInstance;
}

/**
 * Create a storage key from artist and album names
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {string} Storage key
 */
function makeKey(artist, album) {
  // Normalize: lowercase and trim to avoid duplicates from case differences
  const normalizedArtist = (artist || '').toLowerCase().trim();
  const normalizedAlbum = (album || '').toLowerCase().trim();
  return `${normalizedArtist}${KEY_SEPARATOR}${normalizedAlbum}`;
}

/**
 * Get all stored MBIDs
 * @returns {Promise<Object<string, string>>} Map of "artist|||album" -> mbid
 */
export async function getAllMbids() {
  try {
    const store = await getStore();
    const mbids = await store.get(MBIDS_KEY);
    return mbids || {};
  } catch (error) {
    console.error('[mbidStore] Failed to get MBIDs:', error);
    return {};
  }
}

/**
 * Get MBID for a specific album by artist and album name
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<string|null>} MBID or null if not found
 */
export async function getMbid(artist, album) {
  if (!artist || !album) {
    return null;
  }
  
  try {
    const mbids = await getAllMbids();
    const key = makeKey(artist, album);
    return mbids[key] || null;
  } catch (error) {
    console.error('[mbidStore] Failed to get MBID for:', artist, album, error);
    return null;
  }
}

/**
 * Store MBID for an album
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @param {string} mbid - MusicBrainz Release ID
 * @returns {Promise<void>}
 */
export async function setMbid(artist, album, mbid) {
  if (!mbid || !artist || !album) return;
  
  try {
    const store = await getStore();
    const mbids = await store.get(MBIDS_KEY) || {};
    const key = makeKey(artist, album);
    
    // Only store if we don't already have one for this album
    // (first MBID wins - usually the most accurate)
    if (!mbids[key]) {
      mbids[key] = mbid;
      await store.set(MBIDS_KEY, mbids);
    }
  } catch (error) {
    console.error('[mbidStore] Failed to set MBID:', error);
  }
}

/**
 * Store multiple MBIDs at once
 * @param {Array<{artist: string, album: string, mbid: string}>} entries - Array of artist/album/mbid entries
 * @returns {Promise<void>}
 */
export async function setMbids(entries) {
  if (!entries || entries.length === 0) return;
  
  try {
    const store = await getStore();
    const mbids = await store.get(MBIDS_KEY) || {};
    
    let added = 0;
    for (const { artist, album, mbid } of entries) {
      if (!artist || !album || !mbid) continue;
      
      const key = makeKey(artist, album);
      if (!mbids[key]) {
        mbids[key] = mbid;
        added++;
      }
    }
    
    if (added > 0) {
      await store.set(MBIDS_KEY, mbids);
    }
  } catch (error) {
    console.error('[mbidStore] Failed to set MBIDs:', error);
  }
}

/**
 * Check if an MBID exists for an album (without returning the value)
 * Useful for checking before making API calls
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<boolean>} True if MBID exists
 */
export async function hasMbid(artist, album) {
  const mbid = await getMbid(artist, album);
  return mbid !== null;
}

/**
 * Remove MBID for an album
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<void>}
 */
export async function removeMbid(artist, album) {
  if (!artist || !album) return;
  
  try {
    const store = await getStore();
    const mbids = await store.get(MBIDS_KEY) || {};
    const key = makeKey(artist, album);
    delete mbids[key];
    await store.set(MBIDS_KEY, mbids);
  } catch (error) {
    console.error('[mbidStore] Failed to remove MBID:', error);
  }
}

/**
 * Clear all stored MBIDs
 * @returns {Promise<void>}
 */
export async function clearMbids() {
  try {
    const store = await getStore();
    await store.set(MBIDS_KEY, {});
  } catch (error) {
    console.error('[mbidStore] Failed to clear MBIDs:', error);
  }
}
