/**
 * SongPreview Component
 * 
 * Displays a limited preview of songs for the home view.
 * 
 * Props:
 * - songs: array - all songs from the library
 * - limit: number - maximum songs to display (default 8)
 * - onPlay: function - callback when play button clicked
 * - onQueue: function - callback when queue button clicked
 * - isCurrentTrack: function - check if track is currently playing
 */

import React, { useMemo } from 'react';
import PlayerSongCard from '../PlayerSongCard';
import styles from './SongPreview.module.css';

const DEFAULT_LIMIT = 8;

export default function SongPreview({
  songs = [],
  limit = DEFAULT_LIMIT,
  onPlay,
  onQueue,
  isCurrentTrack,
}) {
  const previewSongs = useMemo(() => songs.slice(0, limit), [songs, limit]);

  if (previewSongs.length === 0) {
    return null;
  }

  return (
    <div className={styles.songList}>
      {previewSongs.map((song) => (
        <PlayerSongCard
          key={song.id}
          song={song}
          isPlaying={isCurrentTrack?.(song.id)}
          onPlay={onPlay}
          onQueue={onQueue}
        />
      ))}
    </div>
  );
}
