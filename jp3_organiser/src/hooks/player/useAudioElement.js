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
  const loadRequestIdRef = useRef(0); // Track current load request to cancel stale ones

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  // Initialize audio element once
  useEffect(() => {
    const audio = new Audio();
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

  // Load file as blob URL (does NOT revoke previous - caller handles that)
  const loadAudioAsBlob = useCallback(async (filePath) => {
    const fileBytes = await readFile(filePath);
    const mimeType = getMimeType(filePath);

    const blob = new Blob([fileBytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    return blobUrl;
  }, []);

  // Load and play a track
  const loadAndPlay = useCallback(async (filePath) => {
    const audio = audioRef.current;
    if (!audio || !filePath) return;

    // Increment request ID - any previous in-flight request becomes stale
    const requestId = ++loadRequestIdRef.current;

    try {
      setError(null);
      setIsLoading(true);
      setIsPlaying(false);

      isChangingSourceRef.current = true;
      audio.pause();
      audio.src = '';
      audio.currentTime = 0;
      isChangingSourceRef.current = false;
      
      // Check if this request was superseded
      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      const newBlobUrl = await loadAudioAsBlob(filePath);
      
      // Check again after async operation
      if (requestId !== loadRequestIdRef.current) {
        URL.revokeObjectURL(newBlobUrl);
        return;
      }
      
      // Revoke the OLD blob only after we have the new one ready
      const oldBlobUrl = blobUrlRef.current;
      blobUrlRef.current = newBlobUrl;
      
      // Wait for audio to be fully buffered before playing
      // canplaythrough fires when browser estimates it can play through without stopping
      await new Promise((resolve, reject) => {
        if (requestId !== loadRequestIdRef.current) {
          resolve();
          return;
        }
        
        let resolved = false;
        const cleanup = () => {
          audio.removeEventListener('canplaythrough', onReady);
          audio.removeEventListener('error', onError);
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
            if (requestId === loadRequestIdRef.current) {
              reject(new Error('Audio failed to load')); 
            } else {
              resolve();
            }
          }
        };

        // Add listeners BEFORE setting src
        audio.addEventListener('canplaythrough', onReady);
        audio.addEventListener('error', onError);
        
        // Now set the source
        audio.src = newBlobUrl;
        audio.load();
        
        // Check if already fully buffered (can happen synchronously for cached/small files)
        // readyState 4 = HAVE_ENOUGH_DATA (can play through)
        if (audio.readyState >= 4) {
          resolved = true;
          cleanup();
          resolve();
          return;
        }
      });

      // Final check before playing
      if (requestId !== loadRequestIdRef.current) {
        return;
      }

      // Now safe to revoke the old blob
      if (oldBlobUrl) {
        URL.revokeObjectURL(oldBlobUrl);
      }

      audio.currentTime = 0;
      await audio.play();
      setIsLoading(false);
    } catch (err) {
      if (requestId === loadRequestIdRef.current) {
        console.error('Playback error:', err);
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
