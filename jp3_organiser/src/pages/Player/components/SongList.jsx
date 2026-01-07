/**
 * SongList Component
 * 
 * Displays a list of songs with Play and Queue actions.
 */

import React from 'react';
import { usePlayer } from '../../../hooks';
import PlayerSongCard from './PlayerSongCard';
import styles from './ListStyles.module.css';

export default function SongList({ songs }) {
  const { playTrack, addToQueue, isCurrentTrack } = usePlayer();

  if (songs.length === 0) {
    return <div className={styles.empty}>No songs in library</div>;
  }

  const handlePlay = (song) => {
    playTrack(song, songs);
  };

  const handleQueue = (song) => {
    addToQueue(song);
  };

  return (
    <div className={styles.list}>
      {songs.map((song) => (
        <PlayerSongCard
          key={song.id}
          song={song}
          isPlaying={isCurrentTrack(song.id)}
          onPlay={handlePlay}
          onQueue={handleQueue}
        />
      ))}
    </div>
  );
}
