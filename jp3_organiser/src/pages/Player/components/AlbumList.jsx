/**
 * AlbumList Component
 * 
 * Displays albums as cards in a flex grid layout.
 * Clicking a card expands to show songs below the grid.
 * Uses primary (rose) color scheme.
 */

import React, { useState, useMemo } from 'react';
import { usePlayer } from '../../../hooks';
import PlayerSongCard from './PlayerSongCard';
import styles from './ListStyles.module.css';

export default function AlbumList({ albums, songs }) {
  const { playTrack, addToQueue, isCurrentTrack } = usePlayer();
  const [expandedAlbumId, setExpandedAlbumId] = useState(null);

  // Group songs by album
  const albumSongsMap = useMemo(() => {
    const map = {};
    songs.forEach(song => {
      if (!map[song.albumId]) {
        map[song.albumId] = [];
      }
      map[song.albumId].push(song);
    });
    // Sort each album's songs by track number
    Object.keys(map).forEach(albumId => {
      map[albumId].sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
    });
    return map;
  }, [songs]);

  // Get expanded album data
  const expandedAlbum = useMemo(() => {
    if (!expandedAlbumId) return null;
    return albums.find(a => a.id === expandedAlbumId);
  }, [expandedAlbumId, albums]);

  const expandedSongs = expandedAlbum ? (albumSongsMap[expandedAlbum.id] || []) : [];

  if (albums.length === 0) {
    return <div className={styles.empty}>No albums in library</div>;
  }

  const toggleExpand = (albumId) => {
    setExpandedAlbumId(prev => prev === albumId ? null : albumId);
  };

  const handlePlayAlbum = (album, e) => {
    e.stopPropagation();
    const albumSongs = albumSongsMap[album.id] || [];
    if (albumSongs.length > 0) {
      playTrack(albumSongs[0], albumSongs);
    }
  };

  const handleQueueAlbum = (album, e) => {
    e.stopPropagation();
    const albumSongs = albumSongsMap[album.id] || [];
    addToQueue(albumSongs);
  };

  const handlePlaySong = (song) => {
    playTrack(song, expandedSongs);
  };

  const handleQueueSong = (song) => {
    addToQueue(song);
  };

  return (
    <div>
      {/* Album Cards Grid */}
      <div className={styles.cardGrid}>
        {albums.map((album) => {
          const albumSongs = albumSongsMap[album.id] || [];
          const isExpanded = expandedAlbumId === album.id;

          return (
            <div
              key={album.id}
              className={`${styles.card} ${styles.albumCard} ${isExpanded ? styles.expanded : ''}`}
              onClick={() => toggleExpand(album.id)}
            >
              <span className={styles.cardTitle}>{album.name}</span>
              <span className={styles.cardSubtitle}>{album.artistName}</span>
              <span className={styles.cardMeta}>
                {album.year ? `${album.year} - ` : ''}{albumSongs.length} songs
              </span>
              <div className={styles.cardActions}>
                <button
                  className={styles.cardBtn}
                  onClick={(e) => handlePlayAlbum(album, e)}
                >
                  Play
                </button>
                <button
                  className={`${styles.cardBtn} ${styles.queue}`}
                  onClick={(e) => handleQueueAlbum(album, e)}
                >
                  Queue
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Songs Section */}
      {expandedAlbum && (
        <div className={styles.expandedSection}>
          <div className={styles.expandedHeader}>
            <span className={styles.expandedTitle}>
              {expandedAlbum.name} - {expandedAlbum.artistName}
            </span>
            <button
              className={styles.closeBtn}
              onClick={() => setExpandedAlbumId(null)}
            >
              Close
            </button>
          </div>
          <div className={styles.expandedSongs}>
            {expandedSongs.map((song) => (
              <PlayerSongCard
                key={song.id}
                song={song}
                isPlaying={isCurrentTrack(song.id)}
                onPlay={handlePlaySong}
                onQueue={handleQueueSong}
                showTrackNumber={true}
                subtitle=""
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
