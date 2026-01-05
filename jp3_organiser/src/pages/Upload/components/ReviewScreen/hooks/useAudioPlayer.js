/**
 * useAudioPlayer Hook
 * 
 * Uses Tauri to read files and create blob URLs for reliable local audio playback.
 * Provides play, pause, stop, seek controls with progress tracking.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';

/**
 * Get MIME type from file extension.
 */
function getMimeType(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    opus: 'audio/opus',
    webm: 'audio/webm',
  };
  return mimeTypes[ext] || 'audio/mpeg';
}

export function useAudioPlayer() {
  const audioRef = useRef(null);
  const currentBlobUrlRef = useRef(null);
  const isChangingSourceRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.controls = false;
    audioRef.current = audio;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setError(null);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    const handleError = () => {
      // Don't show error if we're intentionally changing source
      if (isChangingSourceRef.current) return;
      
      const err = audio.error;
      const errorMsg = err 
        ? `Audio error: ${err.message || 'Code: ' + err.code}` 
        : 'Unknown audio error';
      setError(errorMsg);
      setIsPlaying(false);
      setIsLoading(false);
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.pause();
      audio.src = '';
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  // Load audio file as blob URL
  const loadAudioAsBlob = useCallback(async (filePath) => {
    const fileBytes = await readFile(filePath);
    const mimeType = getMimeType(filePath);
    
    // Cleanup previous blob URL
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
    }
    
    const blob = new Blob([fileBytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    currentBlobUrlRef.current = blobUrl;
    
    return blobUrl;
  }, []);

  // Play audio from start
  const play = useCallback(async (filePath) => {
    if (!audioRef.current || !filePath) return;
    
    const audio = audioRef.current;
    
    try {
      setError(null);
      setIsLoading(true);
      setIsPlaying(false);
      
      // If same file and not ended, just resume
      if (currentFilePath === filePath && !audio.ended && audio.src) {
        await audio.play();
        setIsPlaying(true);
        setIsLoading(false);
        return;
      }
      
      // Stop current playback completely
      isChangingSourceRef.current = true;
      audio.pause();
      audio.src = '';
      audio.currentTime = 0;
      
      // Small delay to ensure audio is fully reset
      await new Promise(resolve => setTimeout(resolve, 100));
      isChangingSourceRef.current = false;
      
      // Load new file as blob
      const blobUrl = await loadAudioAsBlob(filePath);
      audio.src = blobUrl;
      setCurrentFilePath(filePath);
      audio.currentTime = 0;
      
      // Wait for audio to be ready
      await new Promise((resolve, reject) => {
        let resolved = false;
        
        const cleanup = () => {
          audio.removeEventListener('loadedmetadata', onReady);
          audio.removeEventListener('canplay', onReady);
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
            reject(new Error('Audio failed to load'));
          }
        };
        
        audio.addEventListener('loadedmetadata', onReady);
        audio.addEventListener('canplay', onReady);
        audio.addEventListener('error', onError);
        
        // Timeout fallback
        setTimeout(() => {
          if (!resolved && audio.readyState >= 2) {
            resolved = true;
            cleanup();
            resolve();
          }
        }, 3000);
      });
      
      // Ensure we're starting from beginning
      audio.currentTime = 0;
      await new Promise(resolve => setTimeout(resolve, 50));
      
      await audio.play();
      setIsPlaying(true);
      setIsLoading(false);
      
    } catch (err) {
      console.error('Playback error:', err);
      setError(`Playback error: ${err.message}`);
      setIsPlaying(false);
      setIsLoading(false);
    }
  }, [currentFilePath, loadAudioAsBlob]);

  // Pause playback
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // Stop and reset
  const stop = useCallback(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      audio.pause();
      audio.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
    }
  }, []);

  // Clear error state (useful when navigating to a different file)
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Seek to specific time (in seconds)
  const seek = useCallback((time) => {
    if (audioRef.current && audioRef.current.src) {
      const audio = audioRef.current;
      const clampedTime = Math.max(0, Math.min(time, audio.duration || 0));
      audio.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    }
  }, []);

  // Toggle play/pause
  const togglePlayPause = useCallback((filePath) => {
    if (isPlaying) {
      pause();
    } else if (filePath) {
      play(filePath);
    }
  }, [isPlaying, pause, play]);

  // Check if a specific file is currently playing
  const isPlayingFile = useCallback((filePath) => {
    return isPlaying && currentFilePath === filePath;
  }, [isPlaying, currentFilePath]);

  return {
    // State
    isPlaying,
    isLoading,
    currentFilePath,
    currentTime,
    duration,
    error,
    
    // Actions
    play,
    pause,
    stop,
    togglePlayPause,
    clearError,
    seek,
    
    // Helper
    isPlayingFile,
  };
}
