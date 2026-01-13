/**
 * RecentRow Component
 * 
 * Horizontal scrollable carousel showing recently played content.
 * Supports songs, albums, artists, and playlists with distinct styling.
 * Songs and albums display album cover art; artists and playlists use icons.
 * 
 * Props:
 * - items: array - recently played items { type, item, playedAt }
 * - libraryPath: string - base library path for cover art loading
 * - onPlaySong: function - play a song
 * - onPlayAlbum: function - play an album
 * - onPlayArtist: function - play an artist
 * - onPlayPlaylist: function - play a playlist
 * - onNavigate: function - navigate to detail view (album, artist, playlist)
 */

import React from 'react';
import { RECENT_TYPE } from '../../../../hooks/useRecents';
import { CoverArt } from '../../../../components';
import styles from './RecentRow.module.css';

// Icons for content types without album art
const TYPE_ICONS = {
  [RECENT_TYPE.ARTIST]: '🎤',
  [RECENT_TYPE.PLAYLIST]: '📋',
};

// Get card style class based on type
function getCardClass(type) {
  switch (type) {
    case RECENT_TYPE.ALBUM:
      return styles.cardAlbum;
    case RECENT_TYPE.ARTIST:
      return styles.cardArtist;
    case RECENT_TYPE.PLAYLIST:
      return styles.cardPlaylist;
    default:
      return styles.cardSong;
  }
}

// Get display info for each item type
function getDisplayInfo(type, item) {
  switch (type) {
    case RECENT_TYPE.SONG:
      return {
        title: item.title,
        subtitle: item.artistName || 'Unknown Artist',
        typeLabel: 'Song',
      };
    case RECENT_TYPE.ALBUM:
      return {
        title: item.name,
        subtitle: item.artistName || 'Unknown Artist',
        typeLabel: 'Album',
      };
    case RECENT_TYPE.ARTIST:
      return {
        title: item.name,
        subtitle: `${item.songCount || 0} songs`,
        typeLabel: 'Artist',
      };
    case RECENT_TYPE.PLAYLIST:
      return {
        title: item.name,
        subtitle: `${item.songCount || 0} songs`,
        typeLabel: 'Playlist',
      };
    default:
      return {
        title: 'Unknown',
        subtitle: '',
        typeLabel: '',
      };
  }
}

export default function RecentRow({
  items = [],
  libraryPath,
  onPlaySong,
  onPlayAlbum,
  onPlayArtist,
  onPlayPlaylist,
  onNavigate,
}) {
  if (items.length === 0) {
    return null;
  }

  const handlePlay = (e, type, item) => {
    e.stopPropagation();
    switch (type) {
      case RECENT_TYPE.SONG:
        onPlaySong?.(item);
        break;
      case RECENT_TYPE.ALBUM:
        onPlayAlbum?.(item);
        break;
      case RECENT_TYPE.ARTIST:
        onPlayArtist?.(item);
        break;
      case RECENT_TYPE.PLAYLIST:
        onPlayPlaylist?.(item);
        break;
    }
  };

  const handleCardClick = (type, item) => {
    // Songs play directly, others navigate to detail view
    if (type === RECENT_TYPE.SONG) {
      onPlaySong?.(item);
    } else {
      onNavigate?.(type, item);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.scrollContainer}>
        {items.map(({ type, item, playedAt }) => {
          const { title, subtitle, typeLabel } = getDisplayInfo(type, item);
          const cardClass = getCardClass(type);
          const icon = TYPE_ICONS[type];
          
          // Determine cover art props for songs and albums
          const hasCoverArt = type === RECENT_TYPE.SONG || type === RECENT_TYPE.ALBUM;
          const coverArtist = type === RECENT_TYPE.SONG 
            ? item.artistName 
            : type === RECENT_TYPE.ALBUM 
              ? item.artistName 
              : null;
          const coverAlbum = type === RECENT_TYPE.SONG 
            ? item.albumName 
            : type === RECENT_TYPE.ALBUM 
              ? item.name 
              : null;
          
          return (
            <div
              key={`${type}-${item.id}`}
              className={`${styles.card} ${cardClass}`}
              onClick={() => handleCardClick(type, item)}
            >
              {hasCoverArt ? (
                <CoverArt
                  artist={coverArtist}
                  album={coverAlbum}
                  libraryPath={libraryPath}
                  size="medium"
                  fallbackIcon={type === RECENT_TYPE.SONG ? '🎵' : '💿'}
                />
              ) : (
                <div className={styles.cardIcon}>{icon}</div>
              )}
              <div className={styles.cardInfo}>
                <span className={styles.title}>{title}</span>
                <span className={styles.subtitle}>{subtitle}</span>
              </div>
              <button
                className={styles.playBtn}
                onClick={(e) => handlePlay(e, type, item)}
                title="Play"
              >
                ▶
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
