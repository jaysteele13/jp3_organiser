/**
 * DetailView Component
 * 
 * Reusable Spotify-style detail page for Albums, Artists, and Playlists.
 * Displays a header with cover art placeholder, title, metadata, and action buttons,
 * followed by a scrollable song list.
 * 
 * Props:
 * - type: 'album' | 'artist' | 'playlist' - determines styling and icon
 * - itemId: number - ID of the album/artist/playlist (for recents tracking)
 * - title: string - main title (album name, artist name, playlist name)
 * - subtitle: string - secondary info (artist name for albums, song/album count for artists)
 * - meta: string - additional metadata (year, duration, etc.)
 * - songs: array - list of songs to display
 * - onBack: function - called when back button is clicked
 * - renderCoverArt: function - optional function to render custom cover art component
 */

import React from 'react';
import { usePlayer } from '../../../../hooks';
import { ScrollingText } from '../../../../components';
import { addToRecents, RECENT_TYPE } from '../../../../services/recentsService';
import PlayerSongCard from '../PlayerSongCard';
import styles from './DetailView.module.css';

// Type-specific icons
const TYPE_ICONS = {
  album: '💿',
  artist: '🎤',
  playlist: '📋',
};

const TYPE_LABELS = {
  album: 'Album',
  artist: 'Artist',
  playlist: 'Playlist',
};

// Map view type to recents type
const TYPE_TO_RECENT = {
  album: RECENT_TYPE.ALBUM,
  artist: RECENT_TYPE.ARTIST,
  playlist: RECENT_TYPE.PLAYLIST,
};

export default function DetailView({
  type = 'album',
  itemId,
  title,
  subtitle,
  meta,
  songs = [],
  onBack,
  renderCoverArt,
}) {
  const { playTrack, addToQueue, isCurrentTrack } = usePlayer();

  const handlePlayAll = () => {
    if (songs.length > 0) {
      playTrack(songs[0], songs);
      // Track in recents
      if (itemId && TYPE_TO_RECENT[type]) {
        addToRecents(TYPE_TO_RECENT[type], itemId);
      }
    }
  };

  const handleShuffle = () => {
    if (songs.length > 0) {
      // Create shuffled copy
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
      // Track in recents
      if (itemId && TYPE_TO_RECENT[type]) {
        addToRecents(TYPE_TO_RECENT[type], itemId);
      }
    }
  };

  const handleQueueAll = () => {
    if (songs.length > 0) {
      addToQueue(songs);
    }
  };

  const handlePlaySong = (song) => {
    // Play this song within the context of the album/artist/playlist (enables next/prev)
    playTrack(song, songs);
  };

  const handleQueueSong = (song) => {
    addToQueue(song);
  };

  // Determine subtitle display for songs based on type
  const getSongSubtitle = (song) => {
    switch (type) {
      case 'album':
        // In album context, don't show album name, just track number via showTrackNumber
        return '';
      case 'artist':
        // In artist context, show album name
        return song.albumName || 'Unknown Album';
      case 'playlist':
      default:
        // In playlist context, show artist - album
        return `${song.artistName}${song.albumName ? ` - ${song.albumName}` : ''}`;
    }
  };

  return (
    <div className={styles.container}>
      {/* Back Button */}
      <button className={styles.backBtn} onClick={onBack}>
        ← Back
      </button>

      {/* Header Section */}
      <div className={`${styles.header} ${styles[type]}`}>
        {/* Cover Art */}
        <div className={styles.coverArt}>
          {renderCoverArt ? (
            renderCoverArt()
          ) : (
            <span className={styles.icon}>{TYPE_ICONS[type]}</span>
          )}
        </div>

        {/* Info Section */}
        <div className={styles.info}>
          <span className={styles.typeLabel}>{TYPE_LABELS[type]}</span>
          <ScrollingText
            className={styles.title}
            as="h1"
          >
            {title}
          </ScrollingText>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {meta && <p className={styles.meta}>{meta}</p>}

          {/* Action Buttons */}
          <div className={styles.actions}>
            <button
              className={`${styles.actionBtn} ${styles.primary}`}
              onClick={handlePlayAll}
              disabled={songs.length === 0}
            >
              Play
            </button>
            <button
              className={`${styles.actionBtn} ${styles.secondary}`}
              onClick={handleShuffle}
              disabled={songs.length === 0}
            >
              Shuffle
            </button>
            <button
              className={`${styles.actionBtn} ${styles.outline}`}
              onClick={handleQueueAll}
              disabled={songs.length === 0}
            >
              Add to Queue
            </button>
          </div>
        </div>
      </div>

      {/* Songs Section */}
      <div className={styles.songsSection}>
        <h2 className={styles.songsHeader}>
          {type === 'artist' ? 'All Songs' : 'Songs'}
          <span className={styles.songCount}>({songs.length})</span>
        </h2>

        {songs.length === 0 ? (
          <p className={styles.empty}>No songs available</p>
        ) : (
          <div className={styles.songsList}>
            {songs.map((song, index) => (
              <PlayerSongCard
                key={`${song.id}-${index}`}
                song={song}
                isPlaying={isCurrentTrack(song.id)}
                onPlay={handlePlaySong}
                onQueue={handleQueueSong}
                showTrackNumber={type === 'album'}
                subtitle={getSongSubtitle(song)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
