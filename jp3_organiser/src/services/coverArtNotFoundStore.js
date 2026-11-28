/**
 * Cover Art Not Found Store Service
 * 
 * Tracks when cover art lookups failed (not found) to avoid unnecessary
 * repeated API calls. An entry stays until a cover is set by hand
 * ("Edit Cover Art"), a new song is uploaded for it, or the cover cache is cleared.
 * 
 * Storage format:
 * {
 *   notFound: {
 *     "album:artist|||album": timestamp (ms since epoch),
 *     "artist:artist|||": timestamp (ms since epoch)
 *   }
 * }
 * 
 * The timestamp records when the lookup failed; it is not used to expire entries.
 */

import { load } from '@tauri-apps/plugin-store';

const STORE_NAME = 'cover_not_found.json';
const NOT_FOUND_KEY = 'notFound';
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
 * Check if album cover was previously not found
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<boolean>} True if should skip API call
 */
export async function isAlbumCoverNotFound(artist, album) {
  if (!artist || !album) return false;

  const notFound = await getAllNotFound();
  return Boolean(notFound[makeAlbumKey(artist, album)]);
}

/**
 * Check if artist cover was previously not found
 * @param {string} artist - Artist name
 * @returns {Promise<boolean>} True if should skip API call
 */
export async function isArtistCoverNotFound(artist) {
  if (!artist) return false;

  const notFound = await getAllNotFound();
  return Boolean(notFound[makeArtistKey(artist)]);
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
 * Remove album not-found entry (e.g., when a new song is uploaded for this album)
 * @param {string} artist - Artist name
 * @param {string} album - Album name
 * @returns {Promise<void>}
 */
export async function removeAlbumNotFound(artist, album) {
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
 * Remove artist not-found entry (e.g., when a new song is uploaded for this artist)
 * @param {string} artist - Artist name
 * @returns {Promise<void>}
 */
export async function removeArtistNotFound(artist) {
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
