/**
 * useRecents Hook
 * 
 * React hook for managing recently played content (songs, albums, artists, playlists).
 * Automatically refreshes when recents are updated elsewhere.
 * 
 * Usage:
 * const { recentItems, hasRecents, addRecent } = useRecents(library);
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  getRecents, 
  addToRecents, 
  clearRecents, 
  onRecentsUpdated,
  RECENT_TYPE 
} from '../services/recentsService';

/**
 * Hook for managing recently played content
 * @param {Object} library - Library data with songs, albums, artists, playlists
 * @returns {Object} Recents state and methods
 */
export function useRecents(library = {}) {
  const [recentEntries, setRecentEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const songs = library?.songs || [];
  const albums = library?.albums || [];
  const artists = library?.artists || [];
  const playlists = library?.playlists || [];

  // Load recents from store
  const loadRecents = useCallback(async () => {
    try {
      const entries = await getRecents();
      setRecentEntries(entries);
    } catch (error) {
      console.error('Failed to load recents:', error);
    }
  }, []);

  // Load recents on mount
  useEffect(() => {
    setIsLoading(true);
    loadRecents().finally(() => setIsLoading(false));
  }, [loadRecents]);

  // Subscribe to recents updates from other parts of the app
  useEffect(() => {
    const unsubscribe = onRecentsUpdated(() => {
      loadRecents();
    });
    return unsubscribe;
  }, [loadRecents]);

  // Resolve recent entries to full objects with type info
  // Deduplicates by type+id to prevent showing same item multiple times
  const recentItems = useMemo(() => {
    if (!recentEntries.length) return [];
    
    // Create lookup maps for O(1) access
    const songMap = new Map(songs.map(s => [s.id, s]));
    const albumMap = new Map(albums.map(a => [a.id, a]));
    const artistMap = new Map(artists.map(a => [a.id, a]));
    const playlistMap = new Map(playlists.map(p => [p.id, p]));

    // Track seen items to deduplicate
    const seen = new Set();

    return recentEntries
      .map(entry => {
        let item = null;
        let type = entry.type;
        
        switch (entry.type) {
          case RECENT_TYPE.SONG:
            item = songMap.get(entry.id);
            break;
          case RECENT_TYPE.ALBUM:
            item = albumMap.get(entry.id);
            break;
          case RECENT_TYPE.ARTIST:
            item = artistMap.get(entry.id);
            break;
          case RECENT_TYPE.PLAYLIST:
            item = playlistMap.get(entry.id);
            break;
          default:
            // Legacy format: assume song if no type
            item = songMap.get(entry.songId || entry.id);
            type = RECENT_TYPE.SONG;
            break;
        }

        if (!item) return null;
        
        // Deduplicate by type+id
        const key = `${type}-${item.id}`;
        if (seen.has(key)) return null;
        seen.add(key);
        
        return {
          type,
          item,
          playedAt: entry.playedAt,
        };
      })
      .filter(Boolean);
  }, [recentEntries, songs, albums, artists, playlists]);

  // Add item to recents
  const addRecent = useCallback(async (type, id) => {
    await addToRecents(type, id);
    // State will be updated via the onRecentsUpdated event
  }, []);

  // Clear all recents
  const clearAll = useCallback(async () => {
    await clearRecents();
    // State will be updated via the onRecentsUpdated event
  }, []);

  // Refresh recents from store (manual refresh if needed)
  const refresh = useCallback(async () => {
    await loadRecents();
  }, [loadRecents]);

  return {
    recentEntries,      // Raw entries with type, id, playedAt
    recentItems,        // Resolved to { type, item, playedAt }
    isLoading,
    addRecent,
    clearAll,
    refresh,
    hasRecents: recentItems.length > 0,
  };
}

// Re-export RECENT_TYPE for convenience
export { RECENT_TYPE };

export default useRecents;
