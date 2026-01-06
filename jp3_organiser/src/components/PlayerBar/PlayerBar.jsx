/**
 * PlayerBar Component
 * 
 * Persistent bottom bar displaying the currently playing track
 * with playback controls and progress slider.
 * 
 * Always visible at the bottom of the app. Shows empty state
 * when no track is playing.
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

  const hasTrack = currentTrack !== null;

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
