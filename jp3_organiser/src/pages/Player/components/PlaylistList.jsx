/**
 * PlaylistList Component
 * 
 * Displays playlists as cards in a flex grid layout.
 * Clicking a card navigates to the playlist detail page.
 * Uses secondary (lime) color scheme.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../../hooks';
import styles from './ListStyles.module.css';

export default function PlaylistList({ playlists, songs }) {
  const navigate = useNavigate();
  const { playTrack, addToQueue } = usePlayer();

  // Create a map of song ID to song object for quick lookup
  const songMap = useMemo(() => {
    const map = {};
    songs.forEach(song => {
      map[song.id] = song;
    });
    return map;
  }, [songs]);

  // Get songs for a playlist by songIds
  const getPlaylistSongs = (playlist) => {
    if (!playlist.songIds) return [];
    return playlist.songIds
      .map(id => songMap[id])
      .filter(Boolean);
  };

  if (playlists.length === 0) {
    return <div className={styles.empty}>No playlists in library</div>;
  }

  const handleCardClick = (playlist) => {
    navigate(`/player/playlist/${playlist.id}`);
  };

  const handlePlayPlaylist = (playlist, e) => {
    e.stopPropagation();
    const playlistSongs = getPlaylistSongs(playlist);
    if (playlistSongs.length > 0) {
      playTrack(playlistSongs[0], playlistSongs);
    }
  };

  const handleQueuePlaylist = (playlist, e) => {
    e.stopPropagation();
    const playlistSongs = getPlaylistSongs(playlist);
    addToQueue(playlistSongs);
  };

  return (
    <div className={styles.cardGrid}>
      {playlists.map((playlist) => {
        const playlistSongs = getPlaylistSongs(playlist);

        return (
          <div
            key={playlist.id}
            className={`${styles.card} ${styles.playlistCard}`}
            onClick={() => handleCardClick(playlist)}
          >
            <span className={styles.cardTitle}>{playlist.name}</span>
            <span className={styles.cardMeta}>
              {playlistSongs.length} songs
            </span>
            <div className={styles.cardActions}>
              <button
                className={styles.cardBtn}
                onClick={(e) => handlePlayPlaylist(playlist, e)}
                disabled={playlistSongs.length === 0}
              >
                Play
              </button>
              <button
                className={`${styles.cardBtn} ${styles.queue}`}
                onClick={(e) => handleQueuePlaylist(playlist, e)}
                disabled={playlistSongs.length === 0}
              >
                Queue
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
