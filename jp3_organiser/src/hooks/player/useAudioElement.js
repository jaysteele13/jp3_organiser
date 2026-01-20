/**
 * useAudioElement Hook
 * 
 * Manages a single HTML Audio element lifecycle.
 * Handles blob URL loading for Tauri local files and audio events.
 * 
 * This is a low-level hook used by usePlayerContext.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';
import { getMimeType } from './playerUtils';

export function useAudioElement({ onEnded, volume = 1 }) {
  const audioRef = useRef(null);
  const blobUrlRef = useRef(null);
  const isChangingSourceRef = useRef(false);
  const abortControllerRef = useRef(null); // AbortController for cancelling pending loads
  const loadVersionRef = useRef(0);


  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio();
    console.log('Audio object created once in audio element hook');
    audio.preload = 'auto';
    audio.volume = volume;
    audioRef.current = audio;

    const handleTimeUpdate = () => setPosition(audio.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setError(null);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      if (isChangingSourceRef.current) return;
      const err = audio.error;
      setError(err ? `Audio error: ${err.message || 'Code: ' + err.code}` : 'Unknown audio error');
      setIsPlaying(false);
      setIsLoading(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.src = '';
      if (blobUrlRef.current) {
        //URL.revokeObjectURL(blobUrlRef.current);
      }
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, []); // Ensure this effect runs only once

  // Attach onEnded callback (changes with queue state)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !onEnded) return;

    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [onEnded]);

  // Sync volume changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Load file as blob URL (does NOT revoke previous - caller handles that)
  const loadAudioAsBlob = useCallback(async (filePath) => {
    const fileBytes = await readFile(filePath);
    const mimeType = getMimeType(filePath);

    const blob = new Blob([fileBytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    return blobUrl;
  }, []);

const loadAndPlay = useCallback(async (filePath) => {
  const audio = audioRef.current;
  if (!audio || !filePath) return;

  // Increment version (invalidates older loads)
  const version = ++loadVersionRef.current;

  // Abort previous load
  abortControllerRef.current?.abort();
  const abortController = new AbortController();
  abortControllerRef.current = abortController;

  try {
    setError(null);
    setIsLoading(true);
    setIsPlaying(false);

    isChangingSourceRef.current = true;
    audio.pause();
    isChangingSourceRef.current = false;

    const newBlobUrl = await loadAudioAsBlob(filePath);

    // Ignore stale loads
    if (abortController.signal.aborted || version !== loadVersionRef.current) {
      return;
    }

    const oldBlobUrl = blobUrlRef.current;
    blobUrlRef.current = newBlobUrl;

    await new Promise((resolve, reject) => {
      let resolved = false;

      const cleanup = () => {
        audio.removeEventListener("canplaythrough", onReady);
        audio.removeEventListener("error", onError);
        abortController.signal.removeEventListener("abort", onAbort);
      };

      const onReady = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      };

      const onError = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error("Audio failed to load"));
        }
      };

      const onAbort = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      };

      audio.addEventListener("canplaythrough", onReady);
      audio.addEventListener("error", onError);
      abortController.signal.addEventListener("abort", onAbort);

      // Atomic swap
      isChangingSourceRef.current = true;
      audio.src = newBlobUrl;
      audio.load();
      isChangingSourceRef.current = false;

      if (audio.readyState >= 4) {
        resolved = true;
        cleanup();
        resolve();
      }
    });

    if (abortController.signal.aborted || version !== loadVersionRef.current) {
      return;
    }

    // Revoke old blob AFTER successful swap
    if (oldBlobUrl) {
      // URL.revokeObjectURL(oldBlobUrl);
    }

    audio.currentTime = 0;
    await audio.play();

    setIsLoading(false);
  } catch (err) {
    if (!abortController.signal.aborted) {
      console.error("Playback error:", err);
      setError(`Playback error: ${err.message}`);
      setIsPlaying(false);
      setIsLoading(false);
    }
  }
}, [loadAudioAsBlob]);


  const pause = useCallback(() => audioRef.current?.pause(), []);

  const resume = useCallback(async () => {
    const audio = audioRef.current;
    // Only resume if we have a loaded source
    if (!audio?.src || audio.src === '') {
      return;
    }
    try {
      await audio.play();
    } catch (err) {
      console.error('Resume error:', err);
    }
  }, []);

  const seek = useCallback((seconds) => {
    const audio = audioRef.current;
    if (audio?.src) {
      const clamped = Math.max(0, Math.min(seconds, audio.duration || 0));
      audio.currentTime = clamped;
      setPosition(clamped);
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = '';
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
    }
  }, []);

  return {
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
  };
}
