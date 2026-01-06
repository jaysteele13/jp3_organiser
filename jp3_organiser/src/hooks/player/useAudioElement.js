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

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
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
        URL.revokeObjectURL(blobUrlRef.current);
      }
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, []);

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

  // Load file as blob URL
  const loadAudioAsBlob = useCallback(async (filePath) => {
    const fileBytes = await readFile(filePath);
    const mimeType = getMimeType(filePath);

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
    }

    const blob = new Blob([fileBytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    blobUrlRef.current = blobUrl;

    return blobUrl;
  }, []);

  // Load and play a track
  const loadAndPlay = useCallback(async (filePath) => {
    const audio = audioRef.current;
    if (!audio || !filePath) return;

    try {
      setError(null);
      setIsLoading(true);
      setIsPlaying(false);

      isChangingSourceRef.current = true;
      audio.pause();
      audio.src = '';
      audio.currentTime = 0;

      await new Promise(resolve => setTimeout(resolve, 50));
      isChangingSourceRef.current = false;

      const blobUrl = await loadAudioAsBlob(filePath);
      audio.src = blobUrl;
      audio.currentTime = 0;

      // Wait for ready state
      await new Promise((resolve, reject) => {
        let resolved = false;
        const cleanup = () => {
          audio.removeEventListener('canplay', onReady);
          audio.removeEventListener('error', onError);
        };
        const onReady = () => { if (!resolved) { resolved = true; cleanup(); resolve(); } };
        const onError = () => { if (!resolved) { resolved = true; cleanup(); reject(new Error('Audio failed to load')); } };

        audio.addEventListener('canplay', onReady);
        audio.addEventListener('error', onError);
        setTimeout(() => { if (!resolved && audio.readyState >= 2) { resolved = true; cleanup(); resolve(); } }, 3000);
      });

      audio.currentTime = 0;
      await audio.play();
      setIsLoading(false);
    } catch (err) {
      console.error('Playback error:', err);
      setError(`Playback error: ${err.message}`);
      setIsPlaying(false);
      setIsLoading(false);
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
