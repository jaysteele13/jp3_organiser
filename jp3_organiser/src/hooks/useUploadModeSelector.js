/**
 * useUploadModeSelector Hook
 * 
 * Manages upload mode selection logic.
 * Handles the transition from mode selection to file selection,
 * including the context form for Album/Artist/Playlist modes.
 * 
 * Upload modes:
 * - SONGS: Direct to file selection (no context)
 * - ALBUM: Show context form (album + artist + year)
 * - ARTIST: Show context form (artist)
 * - PLAYLIST: Show context form (playlist name)
 * 
 * @param {Object} options
 * @param {string} options.libraryPath - Library path for creating empty playlists
 * @param {function} options.navigate - React Router navigate function
 * @param {Object} options.toast - Toast hook instance with showToast method
 * @returns {Object} Mode selection state and handlers
 */

import { useState, useCallback } from 'react';
import { useUploadCache } from './useUploadCache';
import { UPLOAD_MODE, TABS } from '../utils';
import { createPlaylist } from '../services/libraryService';

export function useUploadModeSelector({ libraryPath, navigate, toast } = {}) {
  const cache = useUploadCache();
  
  // Local state for context form UI
  const [showContextForm, setShowContextForm] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);

  // Handle "Add Songs" mode - proceed directly to file selection
  const handleSelectSongsMode = useCallback(() => {
    cache.setUploadMode(UPLOAD_MODE.SONGS);
    cache.setUploadContext({ album: null, artist: null, year: null, playlist: null });
    cache.setModeSelected(true);
  }, [cache]);

  // Handle "Add Album" mode - show context form
  const handleSelectAlbumMode = useCallback(() => {
    setPendingMode(UPLOAD_MODE.ALBUM);
    setShowContextForm(true);
  }, []);

  // Handle "Add Artist" mode - show context form
  const handleSelectArtistMode = useCallback(() => {
    setPendingMode(UPLOAD_MODE.ARTIST);
    setShowContextForm(true);
  }, []);

  // Handle "Add Playlist" mode - show context form
  const handleSelectPlaylistMode = useCallback(() => {
    setPendingMode(UPLOAD_MODE.PLAYLIST);
    setShowContextForm(true);
  }, []);

  // Handle context form submission
  const handleContextSubmit = useCallback((context) => {
    cache.setUploadMode(pendingMode);
    cache.setUploadContext(context);
    setShowContextForm(false);
    setPendingMode(null);
    cache.setModeSelected(true);
  }, [cache, pendingMode]);

  // Handle context form cancel
  const handleContextCancel = useCallback(() => {
    setShowContextForm(false);
    setPendingMode(null);
  }, []);

  // Handle create empty playlist (playlist mode only)
  const handleCreateEmptyPlaylist = useCallback(async (playlistName) => {
    if (!libraryPath) {
      console.error('Library path not available');
      return;
    }

    try {
      await createPlaylist(libraryPath, playlistName, []);
      setShowContextForm(false);
      setPendingMode(null);
      toast?.showToast(`Created empty playlist "${playlistName}"`, 'success');
      navigate?.('/view', { state: { tab: TABS.PLAYLISTS } });
    } catch (err) {
      console.error('Failed to create empty playlist:', err);
      toast?.showToast('Failed to create playlist', 'error');
    }
  }, [libraryPath, navigate, toast]);

  // Handle change mode button click
  const handleChangeMode = useCallback(() => {
    cache.setModeSelected(false);
  }, [cache]);

  return {
    // State
    showContextForm,
    pendingMode,
    modeSelected: cache.modeSelected,
    
    // Handlers
    handleSelectSongsMode,
    handleSelectAlbumMode,
    handleSelectArtistMode,
    handleSelectPlaylistMode,
    handleContextSubmit,
    handleContextCancel,
    handleCreateEmptyPlaylist,
    handleChangeMode,
  };
}
