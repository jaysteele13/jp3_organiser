/**
 * ProgressSlider Component
 * 
 * Displays playback progress with a seekable slider.
 * Shows current time and total duration.
 */

import React, { useCallback } from 'react';
import { formatDuration } from '../../utils/formatters';
import styles from './PlayerBar.module.css';

export default function ProgressSlider({
  position,
  duration,
  onSeek,
  disabled,
}) {
  const progress = duration > 0 ? (position / duration) * 100 : 0;

const handleChange = useCallback((e) => {
  const pct = parseFloat(e.target.value) / 100;
  const newPosition = Math.max(0, Math.min(pct * duration, duration));
  onSeek(newPosition);
}, [duration, onSeek]);

  return (
    <div className={styles.progress}>
      <span className={styles.time}>{formatDuration(position)}</span>
      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={progress}
        onChange={handleChange}
        disabled={disabled || duration === 0}
        className={styles.slider}
        aria-label="Seek"
        style={{
          '--progress': `${progress}%`
        }}
      />
      <span className={styles.time}>{formatDuration(duration)}</span>
    </div>
  );
}
