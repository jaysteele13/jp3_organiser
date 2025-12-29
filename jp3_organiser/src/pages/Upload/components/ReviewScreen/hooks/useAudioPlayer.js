/**
 * useAudioPlayer Hook
 * 
 * Manages audio playback for previewing songs.
 * Supports playing from start or middle of the track.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Playback position options.
 */
export const PlaybackPosition = {
  START: 'start',
  MIDDLE: 'middle',
};

export function useAudioPlayer() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [playbackPosition, setPlaybackPosition] = useState(PlaybackPosition.START);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  // Create audio element on mount
  useEffect(() => {
    audioRef.current = new Audio();
    
    const audio = audioRef.current;
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setError(null);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
    };
    
    const handleError = (e) => {
      console.error('Audio playback error:', e);
      setError('Unable to play audio file');
      setIsPlaying(false);
    };
    
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Load and play audio from a file path
  const play = useCallback((filePath, position = PlaybackPosition.START) => {
    if (!audioRef.current) return;
    
    const audio = audioRef.current;
    setError(null);
    
    // If same file, just toggle play/pause
    if (filePath === currentFilePath && position === playbackPosition) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play().catch(err => {
          console.error('Failed to play:', err);
          setError('Failed to play audio');
        });
        setIsPlaying(true);
      }
      return;
    }
    
    // Load new file or change position
    const assetUrl = convertFileSrc(filePath);
    audio.src = assetUrl;
    
    audio.addEventListener('loadedmetadata', () => {
      // Seek to position
      if (position === PlaybackPosition.MIDDLE && audio.duration > 0) {
        audio.currentTime = audio.duration / 2;
      } else {
        audio.currentTime = 0;
      }
      
      audio.play().catch(err => {
        console.error('Failed to play:', err);
        setError('Failed to play audio');
      });
      setIsPlaying(true);
    }, { once: true });
    
    audio.load();
    setCurrentFilePath(filePath);
    setPlaybackPosition(position);
  }, [currentFilePath, playbackPosition, isPlaying]);

  // Play from start
  const playFromStart = useCallback((filePath) => {
    play(filePath, PlaybackPosition.START);
  }, [play]);

  // Play from middle
  const playFromMiddle = useCallback((filePath) => {
    play(filePath, PlaybackPosition.MIDDLE);
  }, [play]);

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
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  // Check if a specific file is currently playing
  const isPlayingFile = useCallback((filePath) => {
    return isPlaying && currentFilePath === filePath;
  }, [isPlaying, currentFilePath]);

  return {
    // State
    isPlaying,
    currentFilePath,
    playbackPosition,
    currentTime,
    duration,
    error,
    
    // Actions
    play,
    playFromStart,
    playFromMiddle,
    pause,
    stop,
    
    // Helpers
    isPlayingFile,
  };
}
