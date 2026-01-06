/**
 * useQueueManager Hook
 * 
 * Manages the playback queue state and operations.
 * Handles adding, removing, and navigating tracks.
 * 
 * This is a low-level hook used by usePlayerContext.
 */

import { useState, useCallback } from 'react';
import { shuffleArray, REPEAT_MODE } from './playerUtils';

export function useQueueManager() {
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState(REPEAT_MODE.OFF);

  // Derived state
  const currentTrack = currentIndex >= 0 && currentIndex < queue.length 
    ? queue[currentIndex] 
    : null;
  const hasNext = currentIndex < queue.length - 1 || repeatMode === REPEAT_MODE.ALL;
  const hasPrev = currentIndex > 0 || repeatMode === REPEAT_MODE.ALL;

  /**
   * Play a single track immediately, clearing the queue.
   */
  const playNow = useCallback((track) => {
    setQueue([track]);
    setCurrentIndex(0);
  }, []);

  /**
   * Play a track within a queue context.
   */
  const playTrack = useCallback((track, trackQueue) => {
    const newQueue = shuffle ? shuffleArray(trackQueue) : trackQueue;
    const index = newQueue.findIndex(t => t.id === track.id);
    
    setQueue(newQueue);
    setCurrentIndex(index >= 0 ? index : 0);
  }, [shuffle]);

  /**
   * Add tracks to the end of the queue.
   */
  const addToQueue = useCallback((tracks) => {
    const tracksArray = Array.isArray(tracks) ? tracks : [tracks];
    
    setQueue(prev => {
      const newQueue = [...prev, ...tracksArray];
      if (prev.length === 0) {
        setCurrentIndex(0);
      }
      return newQueue;
    });
  }, []);

  /**
   * Clear the queue entirely.
   */
  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentIndex(-1);
  }, []);

  /**
   * Move to next track. Returns true if moved, false if at end.
   */
  const next = useCallback(() => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
      return true;
    } else if (repeatMode === REPEAT_MODE.ALL && queue.length > 0) {
      setCurrentIndex(0);
      return true;
    }
    return false;
  }, [currentIndex, queue.length, repeatMode]);

  /**
   * Move to previous track. Returns true if moved.
   */
  const prev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      return true;
    } else if (repeatMode === REPEAT_MODE.ALL && queue.length > 0) {
      setCurrentIndex(queue.length - 1);
      return true;
    }
    return false;
  }, [currentIndex, queue.length, repeatMode]);

  /**
   * Skip to a specific index in the queue.
   */
  const skipToIndex = useCallback((index) => {
    if (index >= 0 && index < queue.length) {
      setCurrentIndex(index);
    }
  }, [queue.length]);

  /**
   * Remove a track from the queue by index.
   */
  const removeFromQueue = useCallback((index) => {
    if (index < 0 || index >= queue.length) return;

    setQueue(prev => {
      const newQueue = prev.filter((_, i) => i !== index);

      if (index < currentIndex) {
        setCurrentIndex(curr => curr - 1);
      } else if (index === currentIndex) {
        if (newQueue.length === 0) {
          setCurrentIndex(-1);
        } else if (index >= newQueue.length) {
          setCurrentIndex(newQueue.length - 1);
        }
      }

      return newQueue;
    });
  }, [queue.length, currentIndex]);

  /**
   * Toggle shuffle mode.
   */
  const toggleShuffle = useCallback(() => {
    setShuffle(prev => !prev);
  }, []);

  /**
   * Cycle through repeat modes: OFF -> ALL -> ONE -> OFF
   */
  const cycleRepeatMode = useCallback(() => {
    setRepeatMode(prev => {
      switch (prev) {
        case REPEAT_MODE.OFF: return REPEAT_MODE.ALL;
        case REPEAT_MODE.ALL: return REPEAT_MODE.ONE;
        case REPEAT_MODE.ONE: return REPEAT_MODE.OFF;
        default: return REPEAT_MODE.OFF;
      }
    });
  }, []);

  return {
    // State
    queue,
    currentIndex,
    currentTrack,
    shuffle,
    repeatMode,
    hasNext,
    hasPrev,

    // Actions
    playNow,
    playTrack,
    addToQueue,
    clearQueue,
    next,
    prev,
    skipToIndex,
    removeFromQueue,
    toggleShuffle,
    cycleRepeatMode,
  };
}
