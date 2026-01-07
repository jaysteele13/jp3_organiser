/**
 * AlbumList Component
 * 
 * Displays albums with expandable song lists.
 * Play Album plays all songs in track order.
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

  const handlePlaySong = (song, albumSongs) => {
    playTrack(song, albumSongs);
  };

  const handleQueueSong = (song) => {
    addToQueue(song);
  };

  return (
    <div className={styles.list}>
      {albums.map((album) => {
        const albumSongs = albumSongsMap[album.id] || [];
        const isExpanded = expandedAlbumId === album.id;

        return (
          <div key={album.id}>
            <div 
              className={styles.groupHeader}
              onClick={() => toggleExpand(album.id)}
            >
              <div className={styles.groupInfo}>
                <span className={styles.groupTitle}>{album.name}</span>
                <span className={styles.groupSubtitle}>
                  {album.artistName} {album.year ? `(${album.year})` : ''} - {albumSongs.length} songs
                </span>
              </div>
              <div className={styles.groupActions}>
                <button 
                  className={styles.actionBtn}
                  onClick={(e) => handlePlayAlbum(album, e)}
                >
                  Play
                </button>
                <button 
                  className={`${styles.actionBtn} ${styles.queue}`}
                  onClick={(e) => handleQueueAlbum(album, e)}
                >
                  Queue
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className={styles.groupSongs}>
                {albumSongs.map((song) => (
                  <PlayerSongCard
                    key={song.id}
                    song={song}
                    isPlaying={isCurrentTrack(song.id)}
                    onPlay={(s) => handlePlaySong(s, albumSongs)}
                    onQueue={handleQueueSong}
                    showTrackNumber={true}
                    subtitle=""
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
