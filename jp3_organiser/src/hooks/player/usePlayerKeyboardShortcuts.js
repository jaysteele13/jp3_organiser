/**
 * usePlayerKeyboardShortcuts Hook
 * 
 * Registers global keyboard shortcuts for the audio player.
 * 
 * Shortcuts:
 * - Space: Play/Pause (only when not in an input field)
 * - ArrowLeft: Seek backward 5 seconds
 * - ArrowRight: Seek forward 5 seconds
 * - ArrowUp: Volume up 10%
 * - ArrowDown: Volume down 10%
 * - M: Mute/Unmute
 * - N: Next track
 * - P: Previous track (or restart if >3s in)
 * - S: Toggle shuffle
 * - R: Cycle repeat mode
 */

import { useCallback, useEffect, useRef } from 'react';

const SEEK_STEP = 5; // seconds
const VOLUME_STEP = 0.1; // 10%

/**
 * Check if the event target is an input element.
 */
function isInputElement(target) {
  if (!target) return false;
  const tagName = target.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    target.isContentEditable
  );
}

export function usePlayerKeyboardShortcuts({
  isPlaying,
  togglePlayPause,
  seek,
  position,
  duration,
  volume,
  setVolume,
  next,
  prev,
  toggleShuffle,
  cycleRepeatMode,
  currentTrack,
}) {
  // Store callbacks in refs to avoid re-creating event listener
  const callbacksRef = useRef({
    togglePlayPause,
    seek,
    setVolume,
    next,
    prev,
    toggleShuffle,
    cycleRepeatMode,
  });

  // Keep refs updated
  useEffect(() => {
    callbacksRef.current = {
      togglePlayPause,
      seek,
      setVolume,
      next,
      prev,
      toggleShuffle,
      cycleRepeatMode,
    };
  });

  // Store mutable values in refs
  const stateRef = useRef({ position, duration, volume });
  useEffect(() => {
    stateRef.current = { position, duration, volume };
  });

  const handleKeyDown = useCallback((e) => {
    // Skip if in an input field
    if (isInputElement(e.target)) return;

    // Skip if modifier keys are pressed (except for specific combos)
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key.toLowerCase();
    const callbacks = callbacksRef.current;
    const state = stateRef.current;

    switch (key) {
      case ' ': // Space - Play/Pause
        e.preventDefault();
        callbacks.togglePlayPause();
        break;

      case 'arrowleft': // Seek backward
        e.preventDefault();
        if (currentTrack) {
          const newPos = Math.max(0, state.position - SEEK_STEP);
          callbacks.seek(newPos);
        }
        break;

      case 'arrowright': // Seek forward
        e.preventDefault();
        if (currentTrack) {
          const newPos = Math.min(state.duration, state.position + SEEK_STEP);
          callbacks.seek(newPos);
        }
        break;

      case 'arrowup': // Volume up
        e.preventDefault();
        callbacks.setVolume(Math.min(1, state.volume + VOLUME_STEP));
        break;

      case 'arrowdown': // Volume down
        e.preventDefault();
        callbacks.setVolume(Math.max(0, state.volume - VOLUME_STEP));
        break;

      case 'm': // Mute/Unmute
        if (state.volume > 0) {
          callbacks.setVolume(0);
        } else {
          callbacks.setVolume(1);
        }
        break;

      case 'n': // Next track
        if (currentTrack) {
          callbacks.next();
        }
        break;

      case 'p': // Previous track
        if (currentTrack) {
          callbacks.prev();
        }
        break;

      case 's': // Toggle shuffle
        callbacks.toggleShuffle();
        break;

      case 'r': // Cycle repeat mode
        callbacks.cycleRepeatMode();
        break;

      default:
        // Unknown key, do nothing
        break;
    }
  }, [currentTrack]);

  // Register global keydown listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
