/**
 * usePlaylistEditor Hook
 * 
 * Manages state and operations for the PlaylistEditor modal.
 * Handles adding/removing songs from a playlist.
 * 
 * @param {Object} options
 * @param {string} options.libraryPath - Base library path for API calls
 * @param {function} options.onUpdate - Callback after successful playlist modification
 */

import { useState, useCallback, useMemo } from 'react';
import { 
  loadPlaylist, 
  addSongsToPlaylist, 
  removeSongsFromPlaylist 
} from '../../../../../../services/libraryService';

/**
 * @typedef {Object} PlaylistEditorState
 * @property {Object|null} playlist - Currently editing playlist (with songIds)
 * @property {boolean} isOpen - Whether the editor modal is open
 * @property {boolean} isLoading - Loading state for async operations
 * @property {string|null} error - Error message if any
 * @property {Set<number>} selectedSongIds - Songs selected for batch add
 * @property {string} searchQuery - Current search filter for song picker
 */

export default function usePlaylistEditor({ libraryPath, onUpdate }) {
  const [playlist, setPlaylist] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSongIds, setSelectedSongIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Open the editor for a specific playlist
   * Loads full playlist data (including songIds)
   */
  const openEditor = useCallback(async (playlistSummary) => {
    setIsLoading(true);
    setError(null);
    setIsOpen(true);
    setSelectedSongIds(new Set());
    setSearchQuery('');

    try {
      const fullPlaylist = await loadPlaylist(libraryPath, playlistSummary.id);
      setPlaylist(fullPlaylist);
    } catch (err) {
      console.error('Failed to load playlist:', err);
      setError('Failed to load playlist details');
      setPlaylist(null);
    } finally {
      setIsLoading(false);
    }
  }, [libraryPath]);

  /**
   * Close the editor and reset state
   */
  const closeEditor = useCallback(() => {
    setIsOpen(false);
    setPlaylist(null);
    setError(null);
    setSelectedSongIds(new Set());
    setSearchQuery('');
  }, []);

  /**
   * Remove a song from the playlist
   */
  const removeSong = useCallback(async (songId) => {
    if (!playlist) return;

    setIsLoading(true);
    setError(null);

    try {
      await removeSongsFromPlaylist(libraryPath, playlist.id, [songId]);
      
      // Update local state
      setPlaylist(prev => ({
        ...prev,
        songIds: prev.songIds.filter(id => id !== songId),
        songCount: prev.songCount - 1,
      }));

      // Notify parent to refresh
      onUpdate?.();
    } catch (err) {
      console.error('Failed to remove song:', err);
      setError('Failed to remove song from playlist');
    } finally {
      setIsLoading(false);
    }
  }, [playlist, libraryPath, onUpdate]);

  /**
   * Add selected songs to the playlist
   */
  const addSelectedSongs = useCallback(async () => {
    if (!playlist || selectedSongIds.size === 0) return;

    setIsLoading(true);
    setError(null);

    const songIdsToAdd = Array.from(selectedSongIds);

    try {
      await addSongsToPlaylist(libraryPath, playlist.id, songIdsToAdd);
      
      // Update local state
      setPlaylist(prev => ({
        ...prev,
        songIds: [...prev.songIds, ...songIdsToAdd],
        songCount: prev.songCount + songIdsToAdd.length,
      }));

      // Clear selection
      setSelectedSongIds(new Set());

      // Notify parent to refresh
      onUpdate?.();
    } catch (err) {
      console.error('Failed to add songs:', err);
      setError('Failed to add songs to playlist');
    } finally {
      setIsLoading(false);
    }
  }, [playlist, selectedSongIds, libraryPath, onUpdate]);

  /**
   * Toggle a song's selection for batch add
   */
  const toggleSongSelection = useCallback((songId) => {
    setSelectedSongIds(prev => {
      const next = new Set(prev);
      if (next.has(songId)) {
        next.delete(songId);
      } else {
        next.add(songId);
      }
      return next;
    });
  }, []);

  /**
   * Clear all selections
   */
  const clearSelection = useCallback(() => {
    setSelectedSongIds(new Set());
  }, []);

  /**
   * Update search query
   */
  const updateSearchQuery = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  /**
   * Set of songIds currently in playlist (for quick lookup)
   */
  const playlistSongIdSet = useMemo(() => {
    return new Set(playlist?.songIds || []);
  }, [playlist?.songIds]);

  return {
    // State
    playlist,
    isOpen,
    isLoading,
    error,
    selectedSongIds,
    searchQuery,
    playlistSongIdSet,

    // Actions
    openEditor,
    closeEditor,
    removeSong,
    addSelectedSongs,
    toggleSongSelection,
    clearSelection,
    updateSearchQuery,
  };
}
