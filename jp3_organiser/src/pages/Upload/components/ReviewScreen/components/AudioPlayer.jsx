/**
 * AudioPlayer Component
 * 
 * Audio playback controls for previewing songs.
 * Features a seekable progress bar - click anywhere to jump to that position.
 */

import React, { useCallback } from 'react';
import { formatDuration } from '../../../../../utils';
import styles from '../ReviewScreen.module.css';

export default function AudioPlayer({ 
  filePath,
  duration,
  isPlaying,
  currentTime,
  error,
  isLoading,
  onPlay,
  onPause,
  onStop,
  onSeek,
}) {
  const handlePlay = () => {
    if (isPlaying) {
      onPause();
    } else if (filePath) {
      onPlay(filePath);
    }
  };

  // Handle click on progress bar to seek
  const handleProgressClick = useCallback((event) => {
    if (!duration || !onSeek) return;
    
    const progressBar = event.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * duration;
    
    onSeek(seekTime);
  }, [duration, onSeek]);

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  // Show progress bar when audio has been loaded (duration > 0) or is playing
  const showProgressBar = duration > 0 || isPlaying || currentTime > 0;

  return (
    <div className={styles.audioPlayer}>
      <div className={styles.playerLabel}>Preview Audio</div>
      
      <div className={styles.playerControls}>
        <button 
          className={`${styles.playButton} ${isPlaying ? styles.playButtonActive : ''}`}
          onClick={handlePlay}
          title={isPlaying ? "Pause" : "Play"}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : (isPlaying ? 'Pause' : 'Play')}
        </button>
        
        {isPlaying && (
          <button 
            className={styles.stopButton}
            onClick={onStop}
            title="Stop and reset"
          >
            Stop
          </button>
        )}
      </div>

      {/* Seekable progress bar */}
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
          <span className={styles.progressTime}>{formatDuration(duration)}</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className={styles.playerError}>{error}</div>
      )}
    </div>
  );
}
