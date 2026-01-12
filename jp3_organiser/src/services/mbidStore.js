/**
 * MBID Store Service
 * 
 * Stores MusicBrainz Release IDs (MBIDs) for albums using tauri-plugin-store.
 * Used to fetch cover art from Cover Art Archive.
 * 
 * Storage format:
 * {
 *   albumMbids: {
 *     [albumId: number]: string (mbid)
 *   }
 * }
 * 
 * Note: MBIDs are stored per-album since cover art is fetched per-album.
 * When uploading songs, we extract the MBID from AudioMetadata.releaseMbid
 * and store it keyed by the albumId returned from save_to_library.
 */

import { load } from '@tauri-apps/plugin-store';

const STORE_NAME = 'mbids.json';
const MBIDS_KEY = 'albumMbids';

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
 * Get all stored MBIDs
 * @returns {Promise<Object<number, string>>} Map of albumId -> mbid
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
 * Get MBID for a specific album
 * @param {number} albumId - Album ID
 * @returns {Promise<string|null>} MBID or null if not found
 */
export async function getMbid(albumId) {
  try {
    const mbids = await getAllMbids();
    return mbids[albumId] || null;
  } catch (error) {
    console.error('[mbidStore] Failed to get MBID for album:', albumId, error);
    return null;
  }
}

/**
 * Store MBID for an album
 * @param {number} albumId - Album ID
 * @param {string} mbid - MusicBrainz Release ID
 * @returns {Promise<void>}
 */
export async function setMbid(albumId, mbid) {
  if (!mbid) return; // Don't store empty MBIDs
  if (albumId === undefined || albumId === null) return; // Validate albumId (0 is valid)
  
  try {
    const store = await getStore();
    const mbids = await store.get(MBIDS_KEY) || {};
    
    // Only store if we don't already have one for this album
    // (first MBID wins - usually the most accurate)
    if (!mbids[albumId]) {
      mbids[albumId] = mbid;
      await store.set(MBIDS_KEY, mbids);
    }
  } catch (error) {
    console.error('[mbidStore] Failed to set MBID:', error);
  }
}

/**
 * Store multiple MBIDs at once
 * @param {Array<{albumId: number, mbid: string}>} entries - Array of albumId/mbid pairs
 * @returns {Promise<void>}
 */
export async function setMbids(entries) {
  if (!entries || entries.length === 0) return;
  
  try {
    const store = await getStore();
    const mbids = await store.get(MBIDS_KEY) || {};
    
    let added = 0;
    for (const { albumId, mbid } of entries) {
      // Validate: mbid must exist, albumId must be a valid number (0 is valid)
      if (mbid && albumId !== undefined && albumId !== null && !mbids[albumId]) {
        mbids[albumId] = mbid;
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
 * Remove MBID for an album
 * @param {number} albumId - Album ID
 * @returns {Promise<void>}
 */
export async function removeMbid(albumId) {
  try {
    const store = await getStore();
    const mbids = await store.get(MBIDS_KEY) || {};
    delete mbids[albumId];
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
