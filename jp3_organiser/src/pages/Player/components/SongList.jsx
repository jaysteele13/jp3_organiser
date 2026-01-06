/**
 * SongList Component
 * 
 * Displays a list of songs with Play and Queue actions.
 */

import React from 'react';
import { usePlayer } from '../../../hooks';
import styles from './ListStyles.module.css';

export default function SongList({ songs }) {
  const { playTrack, addToQueue, isCurrentTrack } = usePlayer();

  if (songs.length === 0) {
    return <div className={styles.empty}>No songs in library</div>;
  }

  const handlePlay = (song) => {
    playTrack(song, songs);
  };

  const handleQueue = (song, e) => {
    e.stopPropagation();
    addToQueue(song);
  };

  return (
    <div className={styles.list}>
      {songs.map((song) => (
        <div 
          key={song.id} 
          className={`${styles.row} ${isCurrentTrack(song.id) ? styles.playing : ''}`}
        >
          <div className={styles.info}>
            <span className={styles.title}>{song.title}</span>
            <span className={styles.subtitle}>
              {song.artistName}{song.albumName ? ` - ${song.albumName}` : ''}
            </span>
          </div>
          <div className={styles.actions}>
            <button 
              className={styles.actionBtn}
              onClick={() => handlePlay(song)}
            >
              Play
            </button>
            <button 
              className={`${styles.actionBtn} ${styles.queue}`}
              onClick={(e) => handleQueue(song, e)}
            >
              Queue
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
