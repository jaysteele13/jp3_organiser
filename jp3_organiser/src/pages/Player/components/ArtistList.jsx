/**
 * ArtistList Component
 * 
 * Displays artists as cards in a flex grid layout.
 * Clicking a card expands to show songs below the grid.
 * Uses quaternary (purple) color scheme.
 */

import React, { useState, useMemo } from 'react';
import { usePlayer } from '../../../hooks';
import PlayerSongCard from './PlayerSongCard';
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

  // Get expanded artist data
  const expandedArtist = useMemo(() => {
    if (!expandedArtistId) return null;
    return artists.find(a => a.id === expandedArtistId);
  }, [expandedArtistId, artists]);

  const expandedSongs = expandedArtist ? (artistSongsMap[expandedArtist.id] || []) : [];

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

  const handlePlaySong = (song) => {
    playTrack(song, expandedSongs);
  };

  const handleQueueSong = (song) => {
    addToQueue(song);
  };

  return (
    <div>
      {/* Artist Cards Grid */}
      <div className={styles.cardGrid}>
        {artists.map((artist) => {
          const artistSongs = artistSongsMap[artist.id] || [];
          const albumCount = artistAlbumCounts[artist.id] || 0;
          const isExpanded = expandedArtistId === artist.id;

          return (
            <div
              key={artist.id}
              className={`${styles.card} ${styles.artistCard} ${isExpanded ? styles.expanded : ''}`}
              onClick={() => toggleExpand(artist.id)}
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

      {/* Expanded Songs Section */}
      {expandedArtist && (
        <div className={styles.expandedSection}>
          <div className={styles.expandedHeader}>
            <span className={styles.expandedTitle}>
              {expandedArtist.name} - All Songs
            </span>
            <button
              className={styles.closeBtn}
              onClick={() => setExpandedArtistId(null)}
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
                subtitle={song.albumName || 'Unknown Album'}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
