/**
 * PlaybackControls Component
 * 
 * Play/pause, previous, next, shuffle, and repeat controls.
 */

import React from 'react';
import { REPEAT_MODE } from '../../hooks';
import styles from './PlayerBar.module.css';

export default function PlaybackControls({
  isPlaying,
  isLoading,
  hasNext,
  hasPrev,
  shuffle,
  repeatMode,
  onTogglePlay,
  onPrev,
  onNext,
  onToggleShuffle,
  onCycleRepeat,
  disabled,
}) {
  const getRepeatIcon = () => {
    switch (repeatMode) {
      case REPEAT_MODE.ONE:
        return '1';
      case REPEAT_MODE.ALL:
        return 'All';
      default:
        return 'Off';
    }
  };

  return (
    <div className={styles.controls}>
      {/* Shuffle */}
      <button
        className={`${styles.controlBtn} ${styles.smallBtn} ${shuffle ? styles.active : ''}`}
        onClick={onToggleShuffle}
        disabled={disabled}
        title={shuffle ? 'Shuffle On' : 'Shuffle Off'}
        aria-label="Toggle shuffle"
      >
        Shf
      </button>

      {/* Previous */}
      <button
        className={`${styles.controlBtn} ${styles.smallBtn}`}
        onClick={onPrev}
        disabled={disabled || !hasPrev}
        title="Previous"
        aria-label="Previous track"
      >
        Prev
      </button>

      {/* Play/Pause */}
      <button
        className={`${styles.controlBtn} ${styles.playBtn}`}
        onClick={onTogglePlay}
        disabled={disabled || isLoading}
        title={isPlaying ? 'Pause' : 'Play'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading ? '...' : isPlaying ? 'Pause' : 'Play'}
      </button>

      {/* Next */}
      <button
        className={`${styles.controlBtn} ${styles.smallBtn}`}
        onClick={onNext}
        disabled={disabled || !hasNext}
        title="Next"
        aria-label="Next track"
      >
        Next
      </button>

      {/* Repeat */}
      <button
        className={`${styles.controlBtn} ${styles.smallBtn} ${repeatMode !== REPEAT_MODE.OFF ? styles.active : ''}`}
        onClick={onCycleRepeat}
        disabled={disabled}
        title={`Repeat: ${getRepeatIcon()}`}
        aria-label="Cycle repeat mode"
      >
        {getRepeatIcon()}
      </button>
    </div>
  );
}
