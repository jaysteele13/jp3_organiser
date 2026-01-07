/**
 * PlaylistList Component
 * 
 * Displays playlists as cards in a flex grid layout.
 * Clicking a card expands to show songs below the grid.
 * Uses secondary (lime) color scheme.
 */

import React, { useState, useMemo } from 'react';
import { usePlayer } from '../../../hooks';
import PlayerSongCard from './PlayerSongCard';
import styles from './ListStyles.module.css';

export default function PlaylistList({ playlists, songs }) {
  const { playTrack, addToQueue, isCurrentTrack } = usePlayer();
  const [expandedPlaylistId, setExpandedPlaylistId] = useState(null);

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

  // Get expanded playlist data
  const expandedPlaylist = useMemo(() => {
    if (!expandedPlaylistId) return null;
    return playlists.find(p => p.id === expandedPlaylistId);
  }, [expandedPlaylistId, playlists]);

  const expandedSongs = expandedPlaylist ? getPlaylistSongs(expandedPlaylist) : [];

  if (playlists.length === 0) {
    return <div className={styles.empty}>No playlists in library</div>;
  }

  const toggleExpand = (playlistId) => {
    setExpandedPlaylistId(prev => prev === playlistId ? null : playlistId);
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

  const handlePlaySong = (song) => {
    playTrack(song, expandedSongs);
  };

  const handleQueueSong = (song) => {
    addToQueue(song);
  };

  return (
    <div>
      {/* Playlist Cards Grid */}
      <div className={styles.cardGrid}>
        {playlists.map((playlist) => {
          const playlistSongs = getPlaylistSongs(playlist);
          const isExpanded = expandedPlaylistId === playlist.id;

          return (
            <div
              key={playlist.id}
              className={`${styles.card} ${styles.playlistCard} ${isExpanded ? styles.expanded : ''}`}
              onClick={() => toggleExpand(playlist.id)}
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

      {/* Expanded Songs Section */}
      {expandedPlaylist && (
        <div className={styles.expandedSection}>
          <div className={styles.expandedHeader}>
            <span className={styles.expandedTitle}>
              {expandedPlaylist.name}
            </span>
            <button
              className={styles.closeBtn}
              onClick={() => setExpandedPlaylistId(null)}
            >
              Close
            </button>
          </div>
          <div className={styles.expandedSongs}>
            {expandedSongs.length === 0 ? (
              <div className={styles.empty}>Playlist is empty</div>
            ) : (
              expandedSongs.map((song, index) => (
                <PlayerSongCard
                  key={`${expandedPlaylist.id}-${song.id}-${index}`}
                  song={song}
                  isPlaying={isCurrentTrack(song.id)}
                  onPlay={handlePlaySong}
                  onQueue={handleQueueSong}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
