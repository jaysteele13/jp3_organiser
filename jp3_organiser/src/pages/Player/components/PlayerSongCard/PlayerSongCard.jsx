/**
 * PlayerSongCard Component
 * 
 * Reusable song row for Player lists (SongList, AlbumList, ArtistList, PlaylistList).
 * Click the row to play, use Queue button to add to queue.
 * 
 * Props:
 * - song: Song object with title, artistName, albumName, trackNumber
 * - isPlaying: Whether this song is currently playing
 * - onPlay: Callback when row is clicked
 * - onQueue: Callback when Queue button is clicked
 * - showTrackNumber: Prefix title with track number (for album context)
 * - subtitle: Custom subtitle string (defaults to "artist - album")
 * 
 * Memoized to prevent unnecessary re-renders in large lists.
 */

import React, { memo } from 'react';
import styles from './PlayerSongCard.module.css';

function PlayerSongCard({ 
  song, 
  isPlaying = false,
  onPlay, 
  onQueue,
  showTrackNumber = false,
  subtitle
}) {
  const handleQueue = (e) => {
    e.stopPropagation();
    onQueue?.(song);
  };

  const handleRowClick = () => {
    onPlay?.(song);
  };

  // Build title with optional track number prefix
  const displayTitle = showTrackNumber && song.trackNumber 
    ? `${song.trackNumber}. ${song.title}` 
    : song.title;

  // Build subtitle: use custom if provided, otherwise default to artist - album
  const displaySubtitle = subtitle !== undefined 
    ? subtitle 
    : `${song.artistName}${song.albumName ? ` - ${song.albumName}` : ''}`;

  return (
    <div className={styles.padding}>
      <div 
        className={`${styles.row} ${isPlaying ? styles.playing : ''}`}
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleRowClick()}
      >
        <div className={styles.info}>
          <span className={styles.title}>{displayTitle}</span>
          {displaySubtitle && (
            <span className={styles.subtitle}>{displaySubtitle}</span>
          )}
        </div>
        <div className={styles.actions}>
          <button 
            className={`${styles.actionBtn} ${styles.queue}`}
            onClick={handleQueue}
          >
            Queue
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(PlayerSongCard);
