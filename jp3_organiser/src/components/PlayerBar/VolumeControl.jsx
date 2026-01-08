/**
 * VolumeControl Component
 * 
 * Volume slider with mute toggle button.
 * Shows volume icon that changes based on level.
 */

import React, { useState, useCallback } from 'react';
import styles from './PlayerBar.module.css';

export default function VolumeControl({ volume, onVolumeChange, disabled }) {
  // Store previous volume for unmute restore
  const [previousVolume, setPreviousVolume] = useState(1);

  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    onVolumeChange(newVolume);
  }, [onVolumeChange]);

  const handleMuteToggle = useCallback(() => {
    if (volume > 0) {
      setPreviousVolume(volume);
      onVolumeChange(0);
    } else {
      onVolumeChange(previousVolume || 1);
    }
  }, [volume, previousVolume, onVolumeChange]);

  const getVolumeIcon = () => {
    if (volume === 0) return 'Mute';
    if (volume < 0.3) return 'Low';
    if (volume < 0.7) return 'Med';
    return 'High';
  };

  const volumePercent = Math.round(volume * 100);

  return (
    <div className={styles.volumeControl}>
      <button
        className={`${styles.volumeBtn} ${volume === 0 ? styles.muted : ''}`}
        onClick={handleMuteToggle}
        disabled={disabled}
        title={volume === 0 ? 'Unmute' : 'Mute'}
        aria-label={volume === 0 ? 'Unmute' : 'Mute'}
      >
        {getVolumeIcon()}
      </button>
      <input
        type="range"
        className={styles.volumeSlider}
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={handleVolumeChange}
        disabled={disabled}
        title={`Volume: ${volumePercent}%`}
        aria-label="Volume"
      />
    </div>
  );
}
