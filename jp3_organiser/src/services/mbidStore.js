/**
 * MBID Store Service
 * 
 * Stores MusicBrainz IDs (MBIDs) for albums and artists using tauri-plugin-store.
 * Used to fetch cover art from Cover Art Archive (albums) and Fanart.tv (artists).
 * 
 * Storage format:
 * {
 *   albumMbids: {
 *     "artist|||album": { mbid: string, acoustidMbid?: string } (album entries)
 *     "artist|||": string (artist mbid - unchanged)
 *   }
 * }
 * 
 * Album entries store both the MusicBrainz MBID (primary) and the AcoustID
 * release MBID (fallback) so Cover Art Archive can be retried with the
 * fallback if the primary returns 404.
 * 
 * Backward compatibility: Old entries stored as plain strings are treated
 * as { mbid: string } with no fallback.
 * 
 * Note: MBIDs are keyed by normalized "artist|||album" string to:
 * - Survive album/artist deletion and re-add cycles (IDs get reused)
 * - Match how we search MusicBrainz (by artist + album name)
 * - Provide stable keys based on actual identity
 * 
 * For artists, the album component is empty (e.g., "pink floyd|||")
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
 * Normalize a stored value to the object format.
 * Handles backward compat: old entries are plain strings, new ones are objects.
 * @param {string|Object|null} value - Stored value
 * @returns {{ mbid: string|null, acoustidMbid: string|null }}
 */
function normalizeAlbumEntry(value) {
  if (!value) return { mbid: null, acoustidMbid: null };
  if (typeof value === 'string') return { mbid: value, acoustidMbid: null };
  return { mbid: value.mbid || null, acoustidMbid: value.acoustidMbid || null };
}

/**
 * Get the primary MBID for a specific album by artist and album name.
 * Returns the MusicBrainz MBID (preferred) as a string.
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<string|null>} MBID or null if not found
 */
export async function getAlbumMbid(artist, album) {
  if (!artist || !album) {
    return null;
  }
  
  try {
    const mbids = await getAllMbids();
    const key = makeKey(artist, album);
    const entry = normalizeAlbumEntry(mbids[key]);
    return entry.mbid;
  } catch (error) {
    console.error('[mbidStore] Failed to get MBID for:', artist, album, error);
    return null;
  }
}

/**
 * Get the AcoustID fallback MBID for a specific album.
 * This is used when the primary MusicBrainz MBID returns no cover art.
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<string|null>} AcoustID MBID or null if not stored
 */
export async function getAlbumAcoustidMbid(artist, album) {
  if (!artist || !album) {
    return null;
  }
  
  try {
    const mbids = await getAllMbids();
    const key = makeKey(artist, album);
    const entry = normalizeAlbumEntry(mbids[key]);
    return entry.acoustidMbid;
  } catch (error) {
    console.error('[mbidStore] Failed to get AcoustID MBID for:', artist, album, error);
    return null;
  }
}



// Get artist MBID

export async function getArtistMbid(artist) {
  if (!artist) {
    return null;
  }
  

  try {
    const mbids = await getAllMbids();
    const key = makeKey(artist, '');

    
    return mbids[key] || null;
  } catch (error) {
    console.error('[mbidStore] Failed to get MBID for:', artist, error);
    return null;
  }
}
export async function setArtistMbid(artist, mbid) {
  if (!mbid || !artist) return;
  
  try {
    const store = await getStore();
    const mbids = await store.get(MBIDS_KEY) || {};
    const key = makeKey(artist, '');
    
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
 * Store MBID for an album
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @param {string} mbid - MusicBrainz Release ID (primary)
 * @param {string} [acoustidMbid] - AcoustID Release ID (fallback)
 * @returns {Promise<void>}
 */
export async function setMbid(artist, album, mbid, acoustidMbid = null) {
  if (!mbid || !artist || !album) return;
  
  try {
    const store = await getStore();
    const mbids = await store.get(MBIDS_KEY) || {};
    const key = makeKey(artist, album);
    
    // Only store if we don't already have one for this album
    // (first MBID wins - usually the most accurate)
    if (!mbids[key]) {
      const entry = { mbid };
      if (acoustidMbid && acoustidMbid !== mbid) {
        entry.acoustidMbid = acoustidMbid;
      }
      mbids[key] = entry;
      await store.set(MBIDS_KEY, mbids);
    }
  } catch (error) {
    console.error('[mbidStore] Failed to set MBID:', error);
  }
}

/**
 * Store multiple MBIDs at once
 * @param {Array<{artist: string, album: string, mbid: string, acoustidMbid?: string}>} entries
 * @returns {Promise<void>}
 */
export async function setMbids(entries) {
  if (!entries || entries.length === 0) return;
  
  try {
    const store = await getStore();
    const mbids = await store.get(MBIDS_KEY) || {};
    
    let added = 0;
    for (const { artist, album, mbid, acoustidMbid } of entries) {
      if (!artist || !album || !mbid) continue;
      
      const key = makeKey(artist, album);
      if (!mbids[key]) {
        const entry = { mbid };
        if (acoustidMbid && acoustidMbid !== mbid) {
          entry.acoustidMbid = acoustidMbid;
        }
        mbids[key] = entry;
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
  const mbid = await getAlbumMbid(artist, album);
  return mbid !== null;
}

/**
 * Get both primary and fallback MBIDs for an album
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<{mbid: string|null, acoustidMbid: string|null}>}
 */
export async function getAlbumMbids(artist, album) {
  if (!artist || !album) {
    return { mbid: null, acoustidMbid: null };
  }
  
  try {
    const mbids = await getAllMbids();
    const key = makeKey(artist, album);
    return normalizeAlbumEntry(mbids[key]);
  } catch (error) {
    console.error('[mbidStore] Failed to get MBIDs for:', artist, album, error);
    return { mbid: null, acoustidMbid: null };
  }
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
