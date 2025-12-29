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
  playbackPosition,
  currentTime,
  error,
  onPlayFromStart,
  onPlayFromMiddle,
  onPause,
}) {
  const handlePlayStart = () => {
    if (isPlaying && playbackPosition === 'start') {
      onPause();
    } else {
      onPlayFromStart(filePath);
    }
  };

  const handlePlayMiddle = () => {
    if (isPlaying && playbackPosition === 'middle') {
      onPause();
    } else {
      onPlayFromMiddle(filePath);
    }
  };

  const isPlayingStart = isPlaying && playbackPosition === 'start';
  const isPlayingMiddle = isPlaying && playbackPosition === 'middle';

  return (
    <div className={styles.audioPlayer}>
      <div className={styles.playerLabel}>Preview Audio</div>
      
      <div className={styles.playerControls}>
        <button 
          className={`${styles.playButton} ${isPlayingStart ? styles.playButtonActive : ''}`}
          onClick={handlePlayStart}
          title="Play from start"
        >
          {isPlayingStart ? 'Pause' : 'Play Start'}
        </button>
        
        <button 
          className={`${styles.playButton} ${isPlayingMiddle ? styles.playButtonActive : ''}`}
          onClick={handlePlayMiddle}
          title="Play from middle"
        >
          {isPlayingMiddle ? 'Pause' : 'Play Middle'}
        </button>
      </div>

      {/* Playback info */}
      {isPlaying && (
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
