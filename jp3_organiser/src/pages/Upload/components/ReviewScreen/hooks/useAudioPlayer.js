/**
 * useAudioPlayer Hook
 * 
 * Manages audio playback for previewing songs.
 * Supports playing from start or middle of the track.
 * 
 * Uses Tauri's fs plugin to read file bytes and create Blob URLs
 * for reliable audio playback of local files.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { readFile } from '@tauri-apps/plugin-fs';

/**
 * Playback position options.
 */
export const PlaybackPosition = {
  START: 'start',
  MIDDLE: 'middle',
};

/**
 * Get MIME type from file extension.
 * @param {string} filePath - File path
 * @returns {string} MIME type
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
  const blobUrlRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentFilePath, setCurrentFilePath] = useState(null);
  const [playbackPosition, setPlaybackPosition] = useState(PlaybackPosition.START);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  // Cleanup blob URL
  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

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
      setIsLoading(false);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
    };
    
    const handleError = (e) => {
      const mediaError = audio?.error;
      
      // MediaError codes: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED
      const errorCodes = {
        1: 'MEDIA_ERR_ABORTED - Playback aborted',
        2: 'MEDIA_ERR_NETWORK - Network error',
        3: 'MEDIA_ERR_DECODE - Error decoding audio',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - Format not supported',
      };
      
      const errorCode = mediaError?.code;
      const errorMessage = errorCodes[errorCode] || 'Unknown playback error';
      
      console.error('Audio playback error:', {
        event: e,
        mediaError,
        errorCode,
        errorMessage,
        audioSrc: audio?.src?.substring(0, 100),
        networkState: audio?.networkState,
        readyState: audio?.readyState,
      });
      
      setError(errorMessage);
      setIsPlaying(false);
      setIsLoading(false);
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
      cleanupBlobUrl();
    };
  }, [cleanupBlobUrl]);

  /**
   * Load audio file bytes and create a Blob URL.
   * @param {string} filePath - Absolute path to audio file
   * @returns {Promise<string>} Blob URL
   */
  const loadAudioFile = useCallback(async (filePath) => {
    console.log('Loading audio file:', filePath);
    
    try {
      // Read file bytes using Tauri fs plugin
      const fileBytes = await readFile(filePath);
      
      console.log('File read successfully:', {
        path: filePath,
        size: fileBytes.byteLength,
      });
      
      // Create Blob with correct MIME type
      const mimeType = getMimeType(filePath);
      const blob = new Blob([fileBytes], { type: mimeType });
      
      // Cleanup previous blob URL
      cleanupBlobUrl();
      
      // Create new blob URL
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      
      console.log('Blob URL created:', {
        mimeType,
        blobSize: blob.size,
        url: blobUrl.substring(0, 50),
      });
      
      return blobUrl;
    } catch (err) {
      console.error('Failed to read audio file:', {
        path: filePath,
        error: err,
        message: err.message || String(err),
      });
      throw new Error(`Failed to read file: ${err.message || err}`);
    }
  }, [cleanupBlobUrl]);

  // Load and play audio from a file path
  const play = useCallback(async (filePath, position = PlaybackPosition.START) => {
    if (!audioRef.current) return;
    
    const audio = audioRef.current;
    setError(null);
    
    // If same file, just toggle play/pause
    if (filePath === currentFilePath && position === playbackPosition) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        try {
          await audio.play();
          setIsPlaying(true);
        } catch (err) {
          console.error('Failed to resume playback:', err);
          setError('Failed to resume playback');
        }
      }
      return;
    }
    
    // Load new file
    setIsLoading(true);
    
    try {
      const blobUrl = await loadAudioFile(filePath);
      
      audio.src = blobUrl;
      setCurrentFilePath(filePath);
      setPlaybackPosition(position);
      
      // Wait for metadata then seek and play
      audio.addEventListener('loadedmetadata', async () => {
        // Seek to position
        if (position === PlaybackPosition.MIDDLE && audio.duration > 0) {
          audio.currentTime = audio.duration / 2;
        } else {
          audio.currentTime = 0;
        }
        
        try {
          await audio.play();
          setIsPlaying(true);
        } catch (err) {
          console.error('Failed to start playback:', err);
          setError('Failed to start playback');
        }
      }, { once: true });
      
      audio.load();
    } catch (err) {
      setError(err.message);
      setIsLoading(false);
    }
  }, [currentFilePath, playbackPosition, isPlaying, loadAudioFile]);

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
    isLoading,
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
