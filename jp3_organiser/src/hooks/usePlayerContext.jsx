/**
 * usePlayerContext - Global Audio Player Context
 * 
 * Orchestrates the audio player by composing:
 * - useAudioElement: Audio element lifecycle and controls
 * - useQueueManager: Queue state and navigation
 * 
 * Provides a unified API for the entire app to control playback.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAudioElement } from './player/useAudioElement';
import { useQueueManager } from './player/useQueueManager';
import { REPEAT_MODE } from './player/playerUtils';
import { addToRecents, RECENT_TYPE } from '../services/recentsService';

const PlayerContext = createContext(null);

/**
 * Construct absolute path for audio files in the library.
 * Library structure: {libraryPath}/jp3/music/{relativePath}
 */
function resolveAudioPath(libraryPath, relativePath) {
  if (!libraryPath || !relativePath) return null;
  // Handle both forward and back slashes for cross-platform
  const base = libraryPath.replace(/\\/g, '/').replace(/\/$/, '');
  const rel = relativePath.replace(/\\/g, '/').replace(/^\//, '');
  return `${base}/jp3/music/${rel}`;
}

/**
 * PlayerProvider - Wraps the app to provide global audio player state
 * 
 * Must be placed at the app root to ensure the audio element persists
 * across route changes.
 */
export function PlayerProvider({ children }) {
  const [volume, setVolumeState] = useState(1);
  const [libraryPath, setLibraryPathState] = useState(null);

  // Queue management
  const queueManager = useQueueManager();
  const {
    queue,
    currentIndex,
    currentTrack,
    shuffle,
    repeatMode,
    hasNext,
    hasPrev,
    playNow,
    playTrack,
    addToQueue,
    clearQueue: clearQueueState,
    next: nextTrack,
    prev: prevTrack,
    skipToIndex,
    removeFromQueue: removeFromQueueState,
    reorderQueue,
    toggleShuffle,
    cycleRepeatMode,
  } = queueManager;

  // Handle track ended - advance queue or repeat
  const handleTrackEnded = useCallback(() => {
    if (repeatMode === REPEAT_MODE.ONE) {
      // Handled by audio element - just restart
      return;
    }
    nextTrack();
  }, [repeatMode, nextTrack]);

  // Audio element management
  const audioElement = useAudioElement({
    onEnded: handleTrackEnded,
    volume,
  });
  const {
    isPlaying,
    isLoading,
    position,
    duration,
    error,
    loadAndPlay,
    pause,
    resume,
    seek,
    stop,
  } = audioElement;

  // Auto-play when currentIndex or libraryPath changes
  // Uses a ref to track the last successfully triggered play to avoid duplicates
  const lastPlayedRef = useRef({ index: -1, path: null });
  
  useEffect(() => {
    // Need both a track and library path to play
    if (!currentTrack?.path || !libraryPath) {
      return;
    }
    
    // Avoid re-triggering for the same track
    const playKey = `${currentIndex}:${currentTrack.path}`;
    const lastKey = `${lastPlayedRef.current.index}:${lastPlayedRef.current.path}`;
    
    if (playKey === lastKey) {
      return;
    }
    
    const fullPath = resolveAudioPath(libraryPath, currentTrack.path);
    if (fullPath) {
      lastPlayedRef.current = { index: currentIndex, path: currentTrack.path };
      loadAndPlay(fullPath);
      
      // Track this song in recents
      if (currentTrack.id) {
        addToRecents(RECENT_TYPE.SONG, currentTrack.id).catch(err => {
          console.warn('Failed to add to recents:', err);
        });
      }
    }
  }, [currentIndex, currentTrack?.path, libraryPath, loadAndPlay]);

  // Handle repeat one - seek to start when track ends
  useEffect(() => {
    if (repeatMode === REPEAT_MODE.ONE && !isPlaying && position > 0 && duration > 0) {
      // Track ended with repeat one - restart it
      if (position >= duration - 0.5) {
        seek(0);
        resume();
      }
    }
  }, [repeatMode, isPlaying, position, duration, seek, resume]);

  // ============================================
  // PUBLIC API
  // ============================================

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume]);

  const prev = useCallback(() => {
    // If more than 3 seconds into track, restart instead
    if (position > 3) {
      seek(0);
      return;
    }
    prevTrack();
  }, [position, seek, prevTrack]);

  const clearQueue = useCallback(() => {
    stop();
    clearQueueState();
  }, [stop, clearQueueState]);

  const removeFromQueue = useCallback((index) => {
    const isRemovingCurrent = index === currentIndex;
    removeFromQueueState(index);
    
    // If removing the current track and queue is now empty, stop
    if (isRemovingCurrent && queue.length <= 1) {
      stop();
    }
  }, [removeFromQueueState, currentIndex, queue.length, stop]);

  const setVolume = useCallback((value) => {
    setVolumeState(Math.max(0, Math.min(1, value)));
  }, []);

  const setLibraryPath = useCallback((path) => {
    setLibraryPathState(path);
  }, []);

  const isCurrentTrack = useCallback((trackId) => {
    return currentTrack?.id === trackId;
  }, [currentTrack]);

  // ============================================
  // CONTEXT VALUE
  // ============================================

  const value = {
    // State
    queue,
    currentIndex,
    currentTrack,
    isPlaying,
    isLoading,
    position,
    duration,
    error,
    shuffle,
    repeatMode,
    volume,
    libraryPath,
    hasNext,
    hasPrev,

    // Playback Controls
    playNow,
    playTrack,
    addToQueue,
    clearQueue,
    pause,
    resume,
    togglePlayPause,
    seek,
    next: nextTrack,
    prev,
    skipToIndex,
    removeFromQueue,
    reorderQueue,

    // Options
    toggleShuffle,
    cycleRepeatMode,
    setVolume,
    setLibraryPath,

    // Helpers
    isCurrentTrack,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

/**
 * Hook to access the player context.
 * Must be used within a PlayerProvider.
 */
export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}

// Re-export constants for convenience
export { REPEAT_MODE };
