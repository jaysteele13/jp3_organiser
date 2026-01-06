/**
 * PlayerBar Component
 * 
 * Persistent bottom bar displaying the currently playing track
 * with playback controls and progress slider.
 * 
 * This component should be rendered at the app root level
 * and remains visible across all routes.
 */

import React, { useState } from 'react';
import { usePlayer } from '../../hooks';
import TrackInfo from './TrackInfo';
import PlaybackControls from './PlaybackControls';
import ProgressSlider from './ProgressSlider';
import QueueDrawer from '../QueueDrawer';
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
    queue,
    togglePlayPause,
    prev,
    next,
    seek,
    toggleShuffle,
    cycleRepeatMode,
  } = usePlayer();

  const [isQueueOpen, setIsQueueOpen] = useState(false);

  // Don't render if no track has ever been loaded
  const hasTrack = currentTrack !== null;

  if (!hasTrack) {
    return null;
  }

  const handleToggleQueue = () => {
    setIsQueueOpen(prev => !prev);
  };

  return (
    <>
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

          {/* Right: Queue Button */}
          <div className={styles.right}>
            <button 
              className={`${styles.queueBtn} ${isQueueOpen ? styles.active : ''}`}
              onClick={handleToggleQueue}
              title="Toggle queue"
            >
              Queue ({queue.length})
            </button>
          </div>
        </div>
      </div>

      {/* Queue Drawer */}
      <QueueDrawer isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
    </>
  );
}
