/**
 * AudioPlayer Component
 * 
 * Audio playback controls for previewing songs.
 * Features a seekable progress bar - click anywhere to jump to that position.
 * 
 * @param {Object} props
 * @param {string} props.filePath - Path to the audio file
 * @param {number} props.fallbackDuration - Fallback duration from file metadata (used before audio loads)
 * @param {Object} props.audio - Audio controller object from useAudioPlayer hook
 */

import React, { useCallback } from 'react';
import { formatDuration } from '../../../../../utils';
import styles from '../ReviewScreen.module.css';

export default function AudioPlayer({ filePath, fallbackDuration, audio }) {
  const { 
    isPlaying, 
    isLoading, 
    currentTime, 
    duration, 
    error,
    play, 
    pause, 
    stop, 
    seek 
  } = audio;

  // Use audio duration if available, otherwise fall back to file metadata
  const displayDuration = duration || fallbackDuration;

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else if (filePath) {
      play(filePath);
    }
  };

  const handleProgressClick = useCallback((event) => {
    if (!displayDuration) return;
    
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * displayDuration;
    
    seek(seekTime);
  }, [displayDuration, seek]);

  const progressPercent = displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0;
  const showProgressBar = displayDuration > 0 || isPlaying || currentTime > 0;

  return (
    <div className={styles.audioPlayer}>
      
      <div className={styles.playerControls}>
        <button 
          className={`${styles.playButton} ${isPlaying ? styles.playButtonActive : ''}`}
          onClick={handlePlayPause}
          title={isPlaying ? "Pause" : "Play"}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : (isPlaying ? 'Pause' : 'Play')}
        </button>
        
        {isPlaying && (
          <button 
            className={styles.stopButton}
            onClick={stop}
            title="Stop and reset"
          >
            Stop
          </button>
        )}
      </div>

      {showProgressBar && (
        <div className={styles.progressContainer}>
          <span className={styles.progressTime}>{formatDuration(currentTime)}</span>
          <div 
            className={styles.progressBar}
            onClick={handleProgressClick}
            title="Click to seek"
          >
            <div 
              className={styles.progressFill}
              style={{ width: `${progressPercent}%` }}
            />
            <div 
              className={styles.progressHandle}
              style={{ left: `${progressPercent}%` }}
            />
          </div>
          <span className={styles.progressTime}>{formatDuration(displayDuration)}</span>
        </div>
      )}

      {error && (
        <div className={styles.playerError}>{error}</div>
      )}
    </div>
  );
}
