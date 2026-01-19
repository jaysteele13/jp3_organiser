/**
 * Cover Art Not Found Store Service
 * 
 * Tracks when cover art lookups failed (not found) to avoid unnecessary
 * repeated API calls. Entries expire after a configurable period.
 * 
 * Storage format:
 * {
 *   notFound: {
 *     "album:artist|||album": timestamp (ms since epoch),
 *     "artist:artist|||": timestamp (ms since epoch)
 *   }
 * }
 * 
 * Rationale:
 * - Artist images on Fanart.tv are rarely updated
 * - Album covers on Cover Art Archive are also relatively static
 * - Default expiration: 3 days (prevents constant re-checking)
 */

import { load } from '@tauri-apps/plugin-store';

const STORE_NAME = 'cover_not_found.json';
const NOT_FOUND_KEY = 'notFound';
const KEY_SEPARATOR = '|||';

// Expiration period: 3 days in milliseconds
const EXPIRATION_MS = 3 * 24 * 60 * 60 * 1000;

let storeInstance = null;
let hasCleanedUp = false;

/**
 * Get or create the store instance
 * Performs one-time cleanup of expired entries on first access per session
 * @returns {Promise<Store>}
 */
async function getStore() {
  if (!storeInstance) {
    storeInstance = await load(STORE_NAME, { autoSave: true });
    
    // Run cleanup once per session on first store access
    if (!hasCleanedUp) {
      hasCleanedUp = true;
      // Run async cleanup without blocking
      cleanupExpiredEntriesInternal(storeInstance).catch(err => {
        console.error('[coverArtNotFoundStore] Startup cleanup failed:', err);
      });
    }
  }
  return storeInstance;
}

/**
 * Internal cleanup function that takes store instance directly
 * @param {Store} store - Store instance
 * @returns {Promise<number>} Number of entries removed
 */
async function cleanupExpiredEntriesInternal(store) {
  try {
    const notFound = await store.get(NOT_FOUND_KEY) || {};
    
    let removed = 0;
    const now = Date.now();
    
    for (const [key, timestamp] of Object.entries(notFound)) {
      if (now - timestamp > EXPIRATION_MS) {
        delete notFound[key];
        removed++;
      }
    }
    
    if (removed > 0) {
      await store.set(NOT_FOUND_KEY, notFound);
      console.log('[coverArtNotFoundStore] Cleaned up', removed, 'expired entries');
    }
    
    return removed;
  } catch (error) {
    console.error('[coverArtNotFoundStore] Failed to cleanup expired entries:', error);
    return 0;
  }
}

/**
 * Create a storage key for album cover not-found tracking
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {string} Storage key
 */
function makeAlbumKey(artist, album) {
  const normalizedArtist = (artist || '').toLowerCase().trim();
  const normalizedAlbum = (album || '').toLowerCase().trim();
  return `album:${normalizedArtist}${KEY_SEPARATOR}${normalizedAlbum}`;
}

/**
 * Create a storage key for artist cover not-found tracking
 * @param {string} artist - Artist name
 * @returns {string} Storage key
 */
function makeArtistKey(artist) {
  const normalizedArtist = (artist || '').toLowerCase().trim();
  return `artist:${normalizedArtist}${KEY_SEPARATOR}`;
}

/**
 * Get all not-found entries (internal use)
 * @returns {Promise<Object<string, number>>} Map of key -> timestamp
 */
async function getAllNotFound() {
  try {
    const store = await getStore();
    const notFound = await store.get(NOT_FOUND_KEY);
    return notFound || {};
  } catch (error) {
    console.error('[coverArtNotFoundStore] Failed to get not-found entries:', error);
    return {};
  }
}

/**
 * Check if an entry is expired
 * @param {number} timestamp - Timestamp when marked as not found
 * @returns {boolean} True if expired and should retry
 */
function isExpired(timestamp) {
  return Date.now() - timestamp > EXPIRATION_MS;
}

/**
 * Check if album cover was previously not found (and not expired)
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<boolean>} True if should skip API call
 */
export async function isAlbumCoverNotFound(artist, album) {
  if (!artist || !album) return false;
  
  try {
    const notFound = await getAllNotFound();
    const key = makeAlbumKey(artist, album);
    const timestamp = notFound[key];
    
    if (!timestamp) return false;
    
    // If expired, clean up and return false (allow retry)
    if (isExpired(timestamp)) {
      await removeAlbumNotFound(artist, album);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[coverArtNotFoundStore] Failed to check album:', artist, album, error);
    return false;
  }
}

/**
 * Check if artist cover was previously not found (and not expired)
 * @param {string} artist - Artist name
 * @returns {Promise<boolean>} True if should skip API call
 */
export async function isArtistCoverNotFound(artist) {
  if (!artist) return false;
  
  try {
    const notFound = await getAllNotFound();
    const key = makeArtistKey(artist);
    const timestamp = notFound[key];
    
    if (!timestamp) return false;
    
    // If expired, clean up and return false (allow retry)
    if (isExpired(timestamp)) {
      await removeArtistNotFound(artist);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[coverArtNotFoundStore] Failed to check artist:', artist, error);
    return false;
  }
}

/**
 * Mark album cover as not found
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<void>}
 */
export async function markAlbumCoverNotFound(artist, album) {
  if (!artist || !album) return;
  
  try {
    const store = await getStore();
    const notFound = await store.get(NOT_FOUND_KEY) || {};
    const key = makeAlbumKey(artist, album);
    notFound[key] = Date.now();
    await store.set(NOT_FOUND_KEY, notFound);
    console.log('[coverArtNotFoundStore] Marked album cover as not found:', artist, '-', album);
  } catch (error) {
    console.error('[coverArtNotFoundStore] Failed to mark album as not found:', error);
  }
}

/**
 * Mark artist cover as not found
 * @param {string} artist - Artist name
 * @returns {Promise<void>}
 */
export async function markArtistCoverNotFound(artist) {
  if (!artist) return;
  
  try {
    const store = await getStore();
    const notFound = await store.get(NOT_FOUND_KEY) || {};
    const key = makeArtistKey(artist);
    notFound[key] = Date.now();
    await store.set(NOT_FOUND_KEY, notFound);
    console.log('[coverArtNotFoundStore] Marked artist cover as not found:', artist);
  } catch (error) {
    console.error('[coverArtNotFoundStore] Failed to mark artist as not found:', error);
  }
}

/**
 * Remove album not-found entry (e.g., when cover becomes available)
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<void>}
 */
async function removeAlbumNotFound(artist, album) {
  if (!artist || !album) return;
  
  try {
    const store = await getStore();
    const notFound = await store.get(NOT_FOUND_KEY) || {};
    const key = makeAlbumKey(artist, album);
    delete notFound[key];
    await store.set(NOT_FOUND_KEY, notFound);
  } catch (error) {
    console.error('[coverArtNotFoundStore] Failed to remove album entry:', error);
  }
}

/**
 * Remove artist not-found entry (e.g., when cover becomes available)
 * @param {string} artist - Artist name
 * @returns {Promise<void>}
 */
async function removeArtistNotFound(artist) {
  if (!artist) return;
  
  try {
    const store = await getStore();
    const notFound = await store.get(NOT_FOUND_KEY) || {};
    const key = makeArtistKey(artist);
    delete notFound[key];
    await store.set(NOT_FOUND_KEY, notFound);
  } catch (error) {
    console.error('[coverArtNotFoundStore] Failed to remove artist entry:', error);
  }
}

/**
 * Clean up all expired entries
 * Note: This is called automatically on first store access each session.
 * Exposed for manual triggering if needed.
 * @returns {Promise<number>} Number of entries removed
 */
export async function cleanupExpiredEntries() {
  const store = await getStore();
  return cleanupExpiredEntriesInternal(store);
}

/**
 * Clear all not-found entries
 * @returns {Promise<void>}
 */
export async function clearNotFoundCache() {
  try {
    const store = await getStore();
    await store.set(NOT_FOUND_KEY, {});
    console.log('[coverArtNotFoundStore] Cleared all not-found entries');
  } catch (error) {
    console.error('[coverArtNotFoundStore] Failed to clear cache:', error);
  }
}
