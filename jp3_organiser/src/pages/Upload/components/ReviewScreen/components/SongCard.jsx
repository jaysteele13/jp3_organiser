/**
 * SongCard Component
 * 
 * Displays the current song being reviewed with metadata,
 * audio player, and file information.
 */

import React from 'react';
import MetadataDisplay from './MetadataDisplay';
import AudioPlayer from './AudioPlayer';
import { formatFileSize } from '../../../../../utils';
import styles from '../ReviewScreen.module.css';

export default function SongCard({ 
  file,
  isPlaying,
  isLoading,
  currentTime,
  duration,
  audioError,
  onPlay,
  onPause,
  onStop,
  onSeek,
}) {
  if (!file) return null;

  return (
    <div className={styles.songCard}>
      {/* File header */}
      <div className={styles.songHeader}>
        <h3 className={styles.songFileName}>{file.fileName}</h3>
        <span className={styles.songFileInfo}>
          {file.fileExtension.toUpperCase()} &bull; {formatFileSize(file.fileSize)}
        </span>
      </div>

      {/* Metadata display */}
      <MetadataDisplay file={file} />

      {/* Audio player */}
      <AudioPlayer
        filePath={file.filePath}
        duration={duration || file.metadata?.durationSecs}
        isPlaying={isPlaying}
        isLoading={isLoading}
        currentTime={currentTime}
        error={audioError}
        onPlay={onPlay}
        onPause={onPause}
        onStop={onStop}
        onSeek={onSeek}
      />
    </div>
  );
}
