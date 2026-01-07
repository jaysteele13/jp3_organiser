/**
 * PlayerSongCard Component
 * 
 * Reusable song row for Player lists (SongList, AlbumList, ArtistList, PlaylistList).
 * Displays song info with Play and Queue actions.
 * 
 * Props:
 * - song: Song object with title, artistName, albumName, trackNumber
 * - isPlaying: Whether this song is currently playing
 * - onPlay: Callback when Play button is clicked
 * - onQueue: Callback when Queue button is clicked
 * - showTrackNumber: Prefix title with track number (for album context)
 * - subtitle: Custom subtitle string (defaults to "artist - album")
 */

import React from 'react';
import styles from './PlayerSongCard.module.css';

export default function PlayerSongCard({ 
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

  const handlePlay = () => {
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
    <div className={`${styles.row} ${isPlaying ? styles.playing : ''}`}>
      <div className={styles.info}>
        <span className={styles.title}>{displayTitle}</span>
        {displaySubtitle && (
          <span className={styles.subtitle}>{displaySubtitle}</span>
        )}
      </div>
      <div className={styles.actions}>
        <button 
          className={styles.actionBtn}
          onClick={handlePlay}
        >
          Play
        </button>
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
