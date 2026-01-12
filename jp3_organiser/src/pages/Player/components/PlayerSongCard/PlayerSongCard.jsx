/**
 * PlayerSongCard Component
 * 
 * Reusable song row for Player lists (SongList, AlbumList, ArtistList, PlaylistList).
 * Click the row to play, use Queue button to add to queue.
 * Artist and album names are clickable links that navigate to their detail pages.
 * 
 * Props:
 * - song: Song object with title, artistName, albumName, artistId, albumId, trackNumber
 * - isPlaying: Whether this song is currently playing
 * - onPlay: Callback when row is clicked
 * - onQueue: Callback when Queue button is clicked
 * - showTrackNumber: Prefix title with track number (for album context)
 * - subtitle: Custom subtitle string (disables artist/album links when provided)
 * 
 * Memoized to prevent unnecessary re-renders in large lists.
 */

import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './PlayerSongCard.module.css';

function PlayerSongCard({ 
  song, 
  isPlaying = false,
  onPlay, 
  onQueue,
  showTrackNumber = false,
  subtitle
}) {
  const navigate = useNavigate();

  const handleQueue = (e) => {
    e.stopPropagation();
    onQueue?.(song);
  };

  const handleRowClick = () => {
    onPlay?.(song);
  };

  const handleArtistClick = (e) => {
    e.stopPropagation();
    if (song.artistId) {
      navigate(`/player/artist/${song.artistId}`);
    }
  };

  const handleAlbumClick = (e) => {
    e.stopPropagation();
    if (song.albumId) {
      navigate(`/player/album/${song.albumId}`);
    }
  };

  // Build title with optional track number prefix
  const displayTitle = showTrackNumber && song.trackNumber 
    ? `${song.trackNumber}. ${song.title}` 
    : song.title;

  // Determine if we should use custom subtitle or interactive links
  const useCustomSubtitle = subtitle !== undefined;
  const hasArtistLink = !useCustomSubtitle && song.artistId;
  const hasAlbumLink = !useCustomSubtitle && song.albumId && song.albumName;

  return (
    <div className={styles.padding}>
      <div 
        className={`${styles.row} ${isPlaying ? styles.playing : ''}`}
        onClick={handleRowClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleRowClick()}
      >
        <div className={styles.info}>
          <span className={styles.title}>{displayTitle}</span>
          
          {useCustomSubtitle ? (
            // Custom subtitle - render as plain text
            subtitle && <span className={styles.subtitle}>{subtitle}</span>
          ) : (
            // Default subtitle with clickable artist/album links
            <span className={styles.subtitle}>
              {hasArtistLink ? (
                <span
                  className={styles.subtitleLink}
                  onClick={handleArtistClick}
                  onKeyDown={(e) => e.key === 'Enter' && handleArtistClick(e)}
                  role="link"
                  tabIndex={0}
                >
                  {song.artistName || 'Unknown'}
                </span>
              ) : (
                <span>{song.artistName || 'Unknown'}</span>
              )}
              
              {song.albumName && (
                <>
                  <span className={styles.subtitleSeparator}> - </span>
                  {hasAlbumLink ? (
                    <span
                      className={styles.subtitleLink}
                      onClick={handleAlbumClick}
                      onKeyDown={(e) => e.key === 'Enter' && handleAlbumClick(e)}
                      role="link"
                      tabIndex={0}
                    >
                      {song.albumName}
                    </span>
                  ) : (
                    <span>{song.albumName}</span>
                  )}
                </>
              )}
            </span>
          )}
        </div>
        <div className={styles.actions}>
          <button 
            className={`${styles.actionBtn} ${styles.queue}`}
            onClick={handleQueue}
          >
            Queue
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(PlayerSongCard);
