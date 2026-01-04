/**
 * useAudioPlayer Hook - Simple Blob Approach
 * 
 * Uses Tauri to read files and create blob URLs for reliable local audio playback.
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
    
    // Set audio properties for better streaming
    audio.preload = 'metadata'; // Only load metadata initially
    audio.controls = false;
    
    audioRef.current = audio;
    
    // Basic event handlers
    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      
      // Debug: Log if audio jumps unexpectedly
      if (time > 0 && time < 0.5 && isPlaying) {
        console.log('Audio started playing from time:', time);
      }
    };
    
    const handleLoadedMetadata = () => {
      console.log('Metadata loaded - duration:', audio.duration);
      setDuration(audio.duration);
      setError(null);
    };
    
    const handleEnded = () => {
      console.log('Audio ended');
      setIsPlaying(false);
      setCurrentTime(0);
    };
    
    const handleError = () => {
      const err = audio.error;
      console.error('Audio error in init:', err);
      
      // Don't show error if we're intentionally changing source
      if (isChangingSourceRef.current) {
        console.log('Ignoring error during source change');
        return;
      }
      
      const errorMsg = err ? `Audio error: ${err.message || 'Code: ' + err.code}` : 'Unknown audio error';
      setError(errorMsg);
      setIsPlaying(false);
      setIsLoading(false);
    };
    
    const handleSeeking = () => {
      console.log('Audio seeking to:', audio.currentTime);
    };
    
    const handleSeeked = () => {
      console.log('Audio seeked to:', audio.currentTime);
    };
    
    const handlePlay = () => {
      console.log('Audio play event fired');
    };
    
    const handlePause = () => {
      console.log('Audio pause event fired');
    };
    
    const handleStalled = () => {
      console.log('Audio stalled - network issue');
    };
    
    const handleSuspend = () => {
      console.log('Audio suspend - browser is not actively playing');
    };
    
    const handleProgress = () => {
      console.log('Audio progress loading');
    };
    
    // Add core event listeners
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('seeking', handleSeeking);
    audio.addEventListener('seeked', handleSeeked);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('suspend', handleSuspend);
    audio.addEventListener('progress', handleProgress);
    
    return () => {
      console.log('Audio effect cleanup (should only happen on unmount)');
      audio.pause();
      audio.src = '';
      // Cleanup blob URL
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
        currentBlobUrlRef.current = null;
      }
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('seeking', handleSeeking);
      audio.removeEventListener('seeked', handleSeeked);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('suspend', handleSuspend);
      audio.removeEventListener('progress', handleProgress);
    };
  }, []); // Remove isPlaying dependency to prevent re-renders

  // Load audio file as blob URL
  const loadAudioAsBlob = useCallback(async (filePath) => {
    try {
      console.log('Reading file:', filePath);
      const fileBytes = await readFile(filePath);
      console.log('File read successfully, size:', fileBytes.byteLength);
      
      const mimeType = getMimeType(filePath);
      console.log('MIME type:', mimeType);
      
      // Cleanup previous blob URL
      if (currentBlobUrlRef.current) {
        URL.revokeObjectURL(currentBlobUrlRef.current);
      }
      
      // Try with and without MIME type for better compatibility
      let blob, blobUrl;
      
      try {
        // First try with MIME type
        blob = new Blob([fileBytes], { type: mimeType });
        blobUrl = URL.createObjectURL(blob);
        console.log('Blob URL created with MIME type:', blobUrl);
      } catch (err) {
        console.log('Failed with MIME type, trying without:', err);
        // Fallback: try without MIME type
        blob = new Blob([fileBytes]);
        blobUrl = URL.createObjectURL(blob);
        console.log('Blob URL created without MIME type:', blobUrl);
      }
      
      currentBlobUrlRef.current = blobUrl;
      return blobUrl;
    } catch (err) {
      console.error('Failed to read file:', err);
      throw new Error(`Failed to read file: ${err.message}`);
    }
  }, []);

  // Play audio from start
  const play = useCallback(async (filePath) => {
    if (!audioRef.current || !filePath) return;
    
    const audio = audioRef.current;
    
    try {
      // Reset state
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
      isChangingSourceRef.current = true; // Mark that we're changing source
      audio.pause();
      audio.src = '';
      audio.currentTime = 0;
      
      // Small delay to ensure audio is fully reset
      await new Promise(resolve => setTimeout(resolve, 100));
      
      isChangingSourceRef.current = false; // Done changing source
      
      // Load new file as blob
      const blobUrl = await loadAudioAsBlob(filePath);
      console.log('Setting audio src to blob URL');
      
      audio.src = blobUrl;
      setCurrentFilePath(filePath);
      
      // Force audio to start from beginning
      audio.currentTime = 0;
      
      // Wait for audio to be ready and metadata loaded
      console.log('Waiting for audio to load...');
      await new Promise((resolve, reject) => {
        let resolved = false;
        
        const handleLoadedMetadata = () => {
          console.log('Metadata loaded, duration:', audio.duration, 'readyState:', audio.readyState);
          if (!resolved) {
            resolved = true;
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            resolve();
          }
        };
        
        const handleCanPlay = () => {
          console.log('Can play, readyState:', audio.readyState);
          if (!resolved) {
            resolved = true;
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            resolve();
          }
        };
        
        const handleError = () => {
          console.error('Audio loading error:', audio.error);
          if (!resolved) {
            resolved = true;
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            reject(new Error('Audio failed to load'));
          }
        };
        
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('error', handleError);
        
        // Timeout fallback
        setTimeout(() => {
          if (!resolved && audio.readyState >= 2) {
            console.log('Timeout fallback, but audio seems ready');
            resolved = true;
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            resolve();
          }
        }, 3000);
      });
      
      // Final check: ensure we're starting from beginning
      console.log('Before play: currentTime =', audio.currentTime);
      audio.currentTime = 0;
      
      // Small delay to ensure time reset takes effect
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log('Attempting to play from time 0...');
      
      // Play the audio
      await audio.play();
      console.log('Play() successful, currentTime after play:', audio.currentTime);
      
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
    
    // Helper
    isPlayingFile,
  };
}