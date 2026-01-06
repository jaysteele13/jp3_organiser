/**
 * PlayerBar Component
 * 
 * Persistent bottom bar displaying the currently playing track
 * with playback controls and progress slider.
 * 
 * This component should be rendered at the app root level
 * and remains visible across all routes.
 */

import React from 'react';
import { usePlayer } from '../../hooks';
import TrackInfo from './TrackInfo';
import PlaybackControls from './PlaybackControls';
import ProgressSlider from './ProgressSlider';
import styles from './PlayerBar.module.css';

export default function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    position,
    duration,
    hasNext,
    hasPrev,
    shuffle,
    repeatMode,
    togglePlayPause,
    prev,
    next,
    seek,
    toggleShuffle,
    cycleRepeatMode,
  } = usePlayer();

  // Don't render if no track has ever been loaded
  const hasTrack = currentTrack !== null;

  if (!hasTrack) {
    return null;
  }

  return (
    <div className={styles.playerBar}>
      <div className={styles.container}>
        {/* Left: Track Info */}
        <TrackInfo track={currentTrack} />

        {/* Center: Controls */}
        <div className={styles.center}>
          <PlaybackControls
            isPlaying={isPlaying}
            isLoading={isLoading}
            hasNext={hasNext}
            hasPrev={hasPrev}
            shuffle={shuffle}
            repeatMode={repeatMode}
            onTogglePlay={togglePlayPause}
            onPrev={prev}
            onNext={next}
            onToggleShuffle={toggleShuffle}
            onCycleRepeat={cycleRepeatMode}
            disabled={!hasTrack}
          />
          <ProgressSlider
            position={position}
            duration={duration}
            onSeek={seek}
            disabled={!hasTrack}
          />
        </div>

        {/* Right: Volume/Queue (placeholder for future) */}
        <div className={styles.right}>
          {/* Future: Volume slider, queue button */}
        </div>
      </div>
    </div>
  );
}
