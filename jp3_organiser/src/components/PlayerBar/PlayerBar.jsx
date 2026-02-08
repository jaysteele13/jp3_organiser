/**
 * PlayerBar Component
 * 
 * Persistent bottom bar displaying the currently playing track
 * with playback controls and progress slider.
 * 
 * Always visible at the bottom of the app. Shows empty state
 * when no track is playing.
 * 
 * Keyboard shortcuts (global, when not in input):
 * - Space: Play/Pause
 * - Arrow Left/Right: Seek -/+ 5 seconds
 * - Arrow Up/Down: Volume +/- 10%
 * - N: Next track
 * - P: Previous track
 * - M: Mute/Unmute
 * - S: Toggle shuffle
 * - R: Cycle repeat mode
 */

import React, { useState } from 'react';
import { usePlayer, usePlayerKeyboardShortcuts } from '../../hooks';
import TrackInfo from './TrackInfo';
import PlaybackControls from './PlaybackControls';
import ProgressSlider from './ProgressSlider';
import VolumeControl from './VolumeControl';
import QueueDrawer from '../QueueDrawer';
import styles from './PlayerBar.module.css';

export default function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    position,
    duration,
    volume,
    hasNext,
    hasPrev,
    shuffle,
    repeatMode,
    context,
    contextIndex,
    userQueue,
    togglePlayPause,
    prev,
    next,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeatMode,
  } = usePlayer();

  // Register global keyboard shortcuts
  usePlayerKeyboardShortcuts({
    isPlaying,
    togglePlayPause,
    seek,
    position,
    duration,
    volume,
    setVolume,
    next,
    prev,
    toggleShuffle,
    cycleRepeatMode,
    currentTrack,
  });

  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const hasTrack = currentTrack !== null;
  
  // Calculate total upcoming tracks (user queue + remaining context)
  const upNextCount = userQueue.length + 
    (contextIndex >= 0 ? Math.max(0, context.length - contextIndex - 1) : 0);

  const handleToggleQueue = () => {
    setIsQueueOpen(prev => !prev);
  };

  return (
    <>
      <div className={`${styles.playerBar} sketch-texture sketch-border`}>
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

          {/* Right: Volume + Queue Button */}
          <div className={styles.right}>
            <VolumeControl
              volume={volume}
              onVolumeChange={setVolume}
              disabled={!hasTrack}
            />
            <button 
              className={`${styles.queueBtn} ${isQueueOpen ? styles.active : ''}`}
              onClick={handleToggleQueue}
              title="Toggle queue"
            >
              Queue {upNextCount > 0 ? `(${upNextCount})` : ''}
            </button>
          </div>
        </div>
      </div>

      {/* Queue Drawer */}
      <QueueDrawer isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
    </>
  );
}
