/**
 * ArtistList Component
 * 
 * Displays artists as cards in a flex grid layout.
 * Clicking a card navigates to the artist detail page.
 * Uses quaternary (purple) color scheme.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../../hooks';
import { addToRecents, RECENT_TYPE } from '../../../services/recentsService';
import styles from './ListStyles.module.css';

export default function ArtistList({ artists, songs }) {
  const navigate = useNavigate();
  const { playTrack, addToQueue } = usePlayer();

  // Group songs by artist for song count
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

  // Count unique albums for each artist
  const artistAlbumCounts = useMemo(() => {
    const counts = {};
    songs.forEach(song => {
      if (!counts[song.artistId]) {
        counts[song.artistId] = new Set();
      }
      if (song.albumId) {
        counts[song.artistId].add(song.albumId);
      }
    });
    return Object.fromEntries(
      Object.entries(counts).map(([id, set]) => [id, set.size])
    );
  }, [songs]);

  if (artists.length === 0) {
    return <div className={styles.empty}>No artists in library</div>;
  }

  const handleCardClick = (artist) => {
    navigate(`/player/artist/${artist.id}`);
  };

  const handlePlayAll = (artist, e) => {
    e.stopPropagation();
    const artistSongs = artistSongsMap[artist.id] || [];
    if (artistSongs.length > 0) {
      playTrack(artistSongs[0], artistSongs);
      addToRecents(RECENT_TYPE.ARTIST, artist.id);
    }
  };

  const handleQueueAll = (artist, e) => {
    e.stopPropagation();
    const artistSongs = artistSongsMap[artist.id] || [];
    addToQueue(artistSongs);
  };

  return (
    <div className={styles.cardGrid}>
      {artists.map((artist) => {
        const artistSongs = artistSongsMap[artist.id] || [];
        const albumCount = artistAlbumCounts[artist.id] || 0;

        return (
          <div
            key={artist.id}
            className={`${styles.card} ${styles.artistCard}`}
            onClick={() => handleCardClick(artist)}
          >
            <span className={styles.cardTitle}>{artist.name}</span>
            <span className={styles.cardMeta}>
              {albumCount} {albumCount === 1 ? 'album' : 'albums'} - {artistSongs.length} songs
            </span>
            <div className={styles.cardActions}>
              <button
                className={styles.cardBtn}
                onClick={(e) => handlePlayAll(artist, e)}
              >
                Play All
              </button>
              <button
                className={`${styles.cardBtn} ${styles.queue}`}
                onClick={(e) => handleQueueAll(artist, e)}
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
