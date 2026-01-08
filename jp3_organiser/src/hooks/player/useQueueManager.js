/**
 * useQueueManager Hook
 * 
 * Manages playback with two separate concepts:
 * 
 * 1. CONTEXT - The source you're playing from (album, playlist, artist, all songs)
 *    - Immutable during playback
 *    - Next/Prev navigate within context
 *    - Songs are NOT removed when played
 * 
 * 2. USER QUEUE - Songs explicitly added via "Add to Queue"
 *    - Plays AFTER current song, BEFORE next context song
 *    - Songs ARE removed when played (consumed)
 * 
 * This matches Spotify/Apple Music behavior.
 */

import { useState, useCallback, useMemo } from 'react';
import { shuffleArray, REPEAT_MODE } from './playerUtils';

export function useQueueManager() {
  // Context: the album/playlist/etc being played
  const [context, setContext] = useState([]);
  const [contextIndex, setContextIndex] = useState(-1);
  
  // User queue: explicitly queued songs (consumed when played)
  const [userQueue, setUserQueue] = useState([]);
  
  // Are we currently playing from user queue?
  const [playingFromUserQueue, setPlayingFromUserQueue] = useState(false);
  
  // Playback options
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState(REPEAT_MODE.OFF);

  // Current track - either from user queue or context
  const currentTrack = useMemo(() => {
    if (playingFromUserQueue && userQueue.length > 0) {
      return userQueue[0];
    }
    if (contextIndex >= 0 && contextIndex < context.length) {
      return context[contextIndex];
    }
    return null;
  }, [playingFromUserQueue, userQueue, context, contextIndex]);

  // Navigation availability
  const hasNext = useMemo(() => {
    // Can always go next if there's user queue
    if (userQueue.length > 0 && !playingFromUserQueue) return true;
    if (userQueue.length > 1 && playingFromUserQueue) return true;
    // Or if there are more context songs
    if (contextIndex < context.length - 1) return true;
    // Or if repeat all is on
    if (repeatMode === REPEAT_MODE.ALL && context.length > 0) return true;
    return false;
  }, [userQueue.length, playingFromUserQueue, contextIndex, context.length, repeatMode]);

  const hasPrev = useMemo(() => {
    // Can go prev if we're in user queue (go back to context)
    if (playingFromUserQueue) return contextIndex >= 0;
    // Or if there are previous context songs
    if (contextIndex > 0) return true;
    // Or if repeat all is on
    if (repeatMode === REPEAT_MODE.ALL && context.length > 0) return true;
    return false;
  }, [playingFromUserQueue, contextIndex, context.length, repeatMode]);

  // Combined queue for display (context remaining + user queue)
  const displayQueue = useMemo(() => {
    const contextRemaining = contextIndex >= 0 
      ? context.slice(contextIndex) 
      : [];
    return {
      contextRemaining,
      userQueue,
      currentTrack,
      playingFromUserQueue,
    };
  }, [context, contextIndex, userQueue, currentTrack, playingFromUserQueue]);

  /**
   * Play a track within a context (album, playlist, etc.)
   * Replaces the current context entirely.
   */
  const playTrack = useCallback((track, trackContext) => {
    const newContext = shuffle ? shuffleArray(trackContext) : [...trackContext];
    const index = newContext.findIndex(t => t.id === track.id);
    
    setContext(newContext);
    setContextIndex(index >= 0 ? index : 0);
    setPlayingFromUserQueue(false);
    // Don't clear user queue - they may want those songs after
  }, [shuffle]);

  /**
   * Play a single track immediately (clears context and user queue).
   */
  const playNow = useCallback((track) => {
    setContext([track]);
    setContextIndex(0);
    setUserQueue([]);
    setPlayingFromUserQueue(false);
  }, []);

  /**
   * Add tracks to the user queue (plays after current song).
   */
  const addToQueue = useCallback((tracks) => {
    const tracksArray = Array.isArray(tracks) ? tracks : [tracks];
    setUserQueue(prev => [...prev, ...tracksArray]);
  }, []);

  /**
   * Clear the user queue only.
   */
  const clearUserQueue = useCallback(() => {
    setUserQueue([]);
    if (playingFromUserQueue) {
      setPlayingFromUserQueue(false);
    }
  }, [playingFromUserQueue]);

  /**
   * Clear everything (context + user queue).
   */
  const clearQueue = useCallback(() => {
    setContext([]);
    setContextIndex(-1);
    setUserQueue([]);
    setPlayingFromUserQueue(false);
  }, []);

  /**
   * Move to next track.
   * Priority: User queue (consumed) > Next context song > Loop (if repeat all)
   */
  const next = useCallback(() => {
    // If currently playing from user queue, consume it and check for more
    if (playingFromUserQueue) {
      setUserQueue(prev => {
        const remaining = prev.slice(1);
        if (remaining.length === 0) {
          // User queue exhausted, continue with context
          setPlayingFromUserQueue(false);
          // Move to next context song
          if (contextIndex < context.length - 1) {
            setContextIndex(contextIndex + 1);
          } else if (repeatMode === REPEAT_MODE.ALL && context.length > 0) {
            setContextIndex(0);
          }
        }
        return remaining;
      });
      return true;
    }

    // If there are songs in user queue, play from there
    if (userQueue.length > 0) {
      setPlayingFromUserQueue(true);
      return true;
    }

    // Otherwise, advance in context
    if (contextIndex < context.length - 1) {
      setContextIndex(prev => prev + 1);
      return true;
    } else if (repeatMode === REPEAT_MODE.ALL && context.length > 0) {
      setContextIndex(0);
      return true;
    }

    return false;
  }, [playingFromUserQueue, userQueue.length, contextIndex, context.length, repeatMode]);

  /**
   * Move to previous track.
   * If in user queue, go back to context. Otherwise go back in context.
   */
  const prev = useCallback(() => {
    // If playing from user queue, go back to current context position
    if (playingFromUserQueue) {
      setPlayingFromUserQueue(false);
      return true;
    }

    // Go back in context
    if (contextIndex > 0) {
      setContextIndex(prev => prev - 1);
      return true;
    } else if (repeatMode === REPEAT_MODE.ALL && context.length > 0) {
      setContextIndex(context.length - 1);
      return true;
    }

    return false;
  }, [playingFromUserQueue, contextIndex, context.length, repeatMode]);

  /**
   * Skip to a specific index in context.
   */
  const skipToIndex = useCallback((index) => {
    if (index >= 0 && index < context.length) {
      setContextIndex(index);
      setPlayingFromUserQueue(false);
    }
  }, [context.length]);

  /**
   * Remove a track from user queue by index.
   */
  const removeFromUserQueue = useCallback((index) => {
    if (index < 0 || index >= userQueue.length) return;
    
    setUserQueue(prev => prev.filter((_, i) => i !== index));
    
    // If we removed the currently playing user queue item
    if (playingFromUserQueue && index === 0) {
      if (userQueue.length <= 1) {
        // No more user queue items, go back to context
        setPlayingFromUserQueue(false);
      }
      // Otherwise the next user queue item becomes current
    }
  }, [userQueue.length, playingFromUserQueue]);

  /**
   * Reorder user queue (drag-and-drop).
   */
  const reorderUserQueue = useCallback((fromIndex, toIndex) => {
    if (fromIndex < 0 || fromIndex >= userQueue.length) return;
    if (toIndex < 0 || toIndex >= userQueue.length) return;
    if (fromIndex === toIndex) return;

    setUserQueue(prev => {
      const newQueue = [...prev];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      return newQueue;
    });
  }, [userQueue.length]);

  /**
   * Toggle shuffle mode.
   * When enabling shuffle, immediately shuffles the remaining context.
   * When disabling, maintains current position.
   */
  const toggleShuffle = useCallback(() => {
    setShuffle(prev => {
      const newShuffle = !prev;
      
      if (newShuffle && context.length > 0 && contextIndex >= 0) {
        // Shuffle the remaining context, keeping current track in place
        const currentTrackItem = context[contextIndex];
        const beforeCurrent = context.slice(0, contextIndex);
        const afterCurrent = context.slice(contextIndex + 1);
        
        // Shuffle the remaining tracks
        const shuffledRemaining = shuffleArray(afterCurrent);
        
        // Rebuild context: [before (unchanged)] + [current] + [shuffled remaining]
        const newContext = [...beforeCurrent, currentTrackItem, ...shuffledRemaining];
        setContext(newContext);
      }
      
      return newShuffle;
    });
  }, [context, contextIndex]);

  /**
   * Shuffle the user queue (not the context).
   */
  const shuffleUserQueue = useCallback(() => {
    if (userQueue.length <= 1) return;
    
    // If playing from user queue, keep current track at front
    if (playingFromUserQueue) {
      const current = userQueue[0];
      const rest = userQueue.slice(1);
      setUserQueue([current, ...shuffleArray(rest)]);
    } else {
      setUserQueue(shuffleArray(userQueue));
    }
  }, [userQueue, playingFromUserQueue]);

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
    context,
    contextIndex,
    userQueue,
    currentTrack,
    playingFromUserQueue,
    shuffle,
    repeatMode,
    hasNext,
    hasPrev,
    displayQueue,

    // Actions
    playNow,
    playTrack,
    addToQueue,
    clearUserQueue,
    clearQueue,
    next,
    prev,
    skipToIndex,
    removeFromUserQueue,
    reorderUserQueue,
    toggleShuffle,
    shuffleUserQueue,
    cycleRepeatMode,
  };
}
