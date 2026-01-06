/**
 * TrackInfo Component
 * 
 * Displays the currently playing track's title, artist, and album.
 */

import React from 'react';
import styles from './PlayerBar.module.css';

export default function TrackInfo({ track }) {
  if (!track) {
    return (
      <div className={styles.trackInfo}>
        <span className={styles.noTrack}>No track selected</span>
      </div>
    );
  }

  return (
    <div className={styles.trackInfo}>
      <span className={styles.trackTitle} title={track.title}>
        {track.title || 'Unknown Title'}
      </span>
      <span className={styles.trackArtist} title={track.artistName}>
        {track.artistName || 'Unknown Artist'}
      </span>
      {track.albumName && (
        <span className={styles.trackAlbum} title={track.albumName}>
          {track.albumName}
        </span>
      )}
    </div>
  );
}
