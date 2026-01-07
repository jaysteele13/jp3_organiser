/**
 * Recents Service
 * 
 * Manages recently played content using tauri-plugin-store for persistence.
 * Tracks songs, albums, artists, and playlists with timestamps.
 * 
 * Storage format:
 * {
 *   recents: [
 *     { type: 'song' | 'album' | 'artist' | 'playlist', id: number, playedAt: number },
 *     ...
 *   ]
 * }
 * 
 * Emits 'recents-updated' custom event when recents change.
 */

import { load } from '@tauri-apps/plugin-store';

const STORE_NAME = 'recents.json';
const RECENTS_KEY = 'recents';
const MAX_RECENTS = 20;
const RECENTS_UPDATED_EVENT = 'recents-updated';

/**
 * Content types that can be tracked
 */
export const RECENT_TYPE = {
  SONG: 'song',
  ALBUM: 'album',
  ARTIST: 'artist',
  PLAYLIST: 'playlist',
};

/**
 * Emit custom event to notify listeners that recents have changed
 */
function emitRecentsUpdated() {
  window.dispatchEvent(new CustomEvent(RECENTS_UPDATED_EVENT));
}

/**
 * Subscribe to recents updates
 * @param {Function} callback - Called when recents are updated
 * @returns {Function} Unsubscribe function
 */
export function onRecentsUpdated(callback) {
  window.addEventListener(RECENTS_UPDATED_EVENT, callback);
  return () => window.removeEventListener(RECENTS_UPDATED_EVENT, callback);
}

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
 * Get all recent entries
 * @returns {Promise<Array<{type: string, id: number, playedAt: number}>>}
 */
export async function getRecents() {
  try {
    const store = await getStore();
    const recents = await store.get(RECENTS_KEY);
    return recents || [];
  } catch (error) {
    console.error('Failed to get recents:', error);
    return [];
  }
}

/**
 * Add an item to recents
 * Removes duplicates (same type+id) and keeps list under MAX_RECENTS
 * @param {string} type - Content type (song, album, artist, playlist)
 * @param {number} id - The item ID
 * @returns {Promise<void>}
 */
export async function addToRecents(type, id) {
  try {
    const store = await getStore();
    let recents = await store.get(RECENTS_KEY) || [];
    
    // Remove existing entry for this item (same type and id)
    recents = recents.filter(entry => !(entry.type === type && entry.id === id));
    
    // Add new entry at the beginning
    recents.unshift({
      type,
      id,
      playedAt: Date.now(),
    });
    
    // Keep only MAX_RECENTS entries
    if (recents.length > MAX_RECENTS) {
      recents = recents.slice(0, MAX_RECENTS);
    }
    
    await store.set(RECENTS_KEY, recents);
    
    // Notify listeners
    emitRecentsUpdated();
  } catch (error) {
    console.error('Failed to add to recents:', error);
  }
}

/**
 * Clear all recents
 * @returns {Promise<void>}
 */
export async function clearRecents() {
  try {
    const store = await getStore();
    await store.set(RECENTS_KEY, []);
    
    // Notify listeners
    emitRecentsUpdated();
  } catch (error) {
    console.error('Failed to clear recents:', error);
  }
}

/**
 * Remove a specific item from recents
 * @param {string} type - Content type
 * @param {number} id - The item ID
 * @returns {Promise<void>}
 */
export async function removeFromRecents(type, id) {
  try {
    const store = await getStore();
    let recents = await store.get(RECENTS_KEY) || [];
    recents = recents.filter(entry => !(entry.type === type && entry.id === id));
    await store.set(RECENTS_KEY, recents);
    
    // Notify listeners
    emitRecentsUpdated();
  } catch (error) {
    console.error('Failed to remove from recents:', error);
  }
}

// Legacy support: keep old function signature working for songs
export async function addSongToRecents(songId) {
  return addToRecents(RECENT_TYPE.SONG, songId);
}
