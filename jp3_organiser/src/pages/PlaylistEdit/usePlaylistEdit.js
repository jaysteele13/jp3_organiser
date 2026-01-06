/**
 * usePlaylistEdit Hook
 * 
 * Manages state and operations for the PlaylistEdit page.
 * Handles loading playlist data, adding/removing songs.
 * 
 * @param {string} libraryPath - Base library path for API calls
 * @param {number} playlistId - Playlist ID to edit
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  loadPlaylist, 
  addSongsToPlaylist, 
  removeSongsFromPlaylist,
  renamePlaylist,
} from '../../services/libraryService';

export default function usePlaylistEdit(libraryPath, playlistId) {
  const [playlist, setPlaylist] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selectedSongIds, setSelectedSongIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Load playlist data on mount
   */
  useEffect(() => {
    if (!libraryPath || !playlistId) {
      setIsLoading(false);
      return;
    }

    const fetchPlaylist = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await loadPlaylist(libraryPath, playlistId);
        setPlaylist(data);
      } catch (err) {
        console.error('Failed to load playlist:', err);
        setError('Failed to load playlist');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlaylist();
  }, [libraryPath, playlistId]);

  /**
   * Remove a song from the playlist
   */
  const removeSong = useCallback(async (songId) => {
    if (!playlist) return;

    setIsSaving(true);
    setError(null);

    try {
      await removeSongsFromPlaylist(libraryPath, playlist.id, [songId]);
      
      // Update local state
      setPlaylist(prev => ({
        ...prev,
        songIds: prev.songIds.filter(id => id !== songId),
        songCount: prev.songCount - 1,
      }));
    } catch (err) {
      console.error('Failed to remove song:', err);
      setError('Failed to remove song from playlist');
    } finally {
      setIsSaving(false);
    }
  }, [playlist, libraryPath]);

  /**
   * Add selected songs to the playlist
   */
  const addSelectedSongs = useCallback(async () => {
    if (!playlist || selectedSongIds.size === 0) return;

    setIsSaving(true);
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
    } catch (err) {
      console.error('Failed to add songs:', err);
      setError('Failed to add songs to playlist');
    } finally {
      setIsSaving(false);
    }
  }, [playlist, selectedSongIds, libraryPath]);

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
   * Rename the playlist
   * @param {string} newName - New playlist name
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const renameCurrentPlaylist = useCallback(async (newName) => {
    if (!playlist) return { success: false, error: 'No playlist loaded' };

    setIsSaving(true);
    setError(null);

    try {
      const result = await renamePlaylist(libraryPath, playlist.id, newName);
      
      // Update local state with new name
      setPlaylist(prev => ({
        ...prev,
        name: result.newName,
      }));

      return { success: true };
    } catch (err) {
      console.error('Failed to rename playlist:', err);
      const errorMessage = err?.toString() || 'Failed to rename playlist';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSaving(false);
    }
  }, [playlist, libraryPath]);

  /**
   * Set of songIds currently in playlist (for quick lookup)
   */
  const playlistSongIdSet = useMemo(() => {
    return new Set(playlist?.songIds || []);
  }, [playlist?.songIds]);

  return {
    // State
    playlist,
    isLoading,
    isSaving,
    error,
    selectedSongIds,
    searchQuery,
    playlistSongIdSet,

    // Actions
    removeSong,
    addSelectedSongs,
    toggleSongSelection,
    clearSelection,
    updateSearchQuery,
    renameCurrentPlaylist,
  };
}
