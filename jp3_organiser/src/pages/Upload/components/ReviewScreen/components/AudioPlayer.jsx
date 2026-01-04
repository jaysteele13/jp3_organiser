/**
 * AudioPlayer Component
 * 
 * Audio playback controls for previewing songs.
 * Allows playing from start or middle of track.
 */

import React from 'react';
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
  onTogglePlayPause,
}) {
  const handlePlay = () => {
    if (isPlaying) {
      onPause();
    } else if (filePath) {
      onPlay(filePath);
    }
  };

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

      {/* Playback info */}
      {(isPlaying || currentTime > 0) && (
        <div className={styles.playbackInfo}>
          <span className={styles.playbackTime}>
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className={styles.playerError}>{error}</div>
      )}
    </div>
  );
}
