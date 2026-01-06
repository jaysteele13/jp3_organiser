/**
 * ArtistList Component
 * 
 * Displays artists with expandable song lists.
 * Play All queues all artist's songs.
 */

import React, { useState, useMemo } from 'react';
import { usePlayer } from '../../../hooks';
import { formatDuration } from '../../../utils/formatters';
import styles from './ListStyles.module.css';

export default function ArtistList({ artists, songs }) {
  const { playTrack, addToQueue, isCurrentTrack } = usePlayer();
  const [expandedArtistId, setExpandedArtistId] = useState(null);

  // Group songs by artist
  const artistSongsMap = useMemo(() => {
    const map = {};
    songs.forEach(song => {
      if (!map[song.artistId]) {
        map[song.artistId] = [];
      }
      map[song.artistId].push(song);
    });
    // Sort by album then track number
    Object.keys(map).forEach(artistId => {
      map[artistId].sort((a, b) => {
        if (a.albumName !== b.albumName) {
          return (a.albumName || '').localeCompare(b.albumName || '');
        }
        return (a.trackNumber || 0) - (b.trackNumber || 0);
      });
    });
    return map;
  }, [songs]);

  if (artists.length === 0) {
    return <div className={styles.empty}>No artists in library</div>;
  }

  const toggleExpand = (artistId) => {
    setExpandedArtistId(prev => prev === artistId ? null : artistId);
  };

  const handlePlayAll = (artist, e) => {
    e.stopPropagation();
    const artistSongs = artistSongsMap[artist.id] || [];
    if (artistSongs.length > 0) {
      playTrack(artistSongs[0], artistSongs);
    }
  };

  const handleQueueAll = (artist, e) => {
    e.stopPropagation();
    const artistSongs = artistSongsMap[artist.id] || [];
    addToQueue(artistSongs);
  };

  const handlePlaySong = (song, artistSongs) => {
    playTrack(song, artistSongs);
  };

  const handleQueueSong = (song, e) => {
    e.stopPropagation();
    addToQueue(song);
  };

  return (
    <div className={styles.list}>
      {artists.map((artist) => {
        const artistSongs = artistSongsMap[artist.id] || [];
        const isExpanded = expandedArtistId === artist.id;

        return (
          <div key={artist.id}>
            <div 
              className={styles.groupHeader}
              onClick={() => toggleExpand(artist.id)}
            >
              <div className={styles.groupInfo}>
                <span className={styles.groupTitle}>{artist.name}</span>
                <span className={styles.groupSubtitle}>
                  {artistSongs.length} songs
                </span>
              </div>
              <div className={styles.groupActions}>
                <button 
                  className={styles.actionBtn}
                  onClick={(e) => handlePlayAll(artist, e)}
                >
                  Play All
                </button>
                <button 
                  className={`${styles.actionBtn} ${styles.queue}`}
                  onClick={(e) => handleQueueAll(artist, e)}
                >
                  Queue
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className={styles.groupSongs}>
                {artistSongs.map((song) => (
                  <div 
                    key={song.id} 
                    className={`${styles.row} ${isCurrentTrack(song.id) ? styles.playing : ''}`}
                  >
                    <div className={styles.info}>
                      <span className={styles.title}>{song.title}</span>
                      <span className={styles.subtitle}>{song.albumName || 'Unknown Album'}</span>
                    </div>
                    <span className={styles.duration}>
                      {formatDuration(song.durationSec)}
                    </span>
                    <div className={styles.actions}>
                      <button 
                        className={styles.actionBtn}
                        onClick={() => handlePlaySong(song, artistSongs)}
                      >
                        Play
                      </button>
                      <button 
                        className={`${styles.actionBtn} ${styles.queue}`}
                        onClick={(e) => handleQueueSong(song, e)}
                      >
                        Queue
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
