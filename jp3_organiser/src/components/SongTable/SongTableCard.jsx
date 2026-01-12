/**
 * SongTableCard Component
 * 
 * Memoized card-style row for SongTable card variant.
 * Displays song info in a horizontal card layout (like Spotify).
 * 
 * Props:
 * - song: Song object with title, artistName, albumName, artistId, albumId
 * - isHighlighted: Whether this card should be highlighted (e.g., currently playing)
 * - onRowClick: Optional click handler for the card
 * - onArtistClick: Optional callback when artist name is clicked
 * - onAlbumClick: Optional callback when album name is clicked
 * - renderActions: Function to render action buttons
 * - showTrackNumber: Show track number prefix in title
 * - subtitle: Custom subtitle (overrides default artist - album display)
 */

import React, { memo } from 'react';
import styles from './SongTable.module.css';

function SongTableCard({
  song,
  isHighlighted = false,
  onRowClick,
  onArtistClick,
  onAlbumClick,
  renderActions,
  showTrackNumber = false,
  subtitle,
}) {
  const handleCardClick = () => {
    if (onRowClick) {
      onRowClick(song);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onRowClick) {
      onRowClick(song);
    }
  };

  const handleArtistClick = (e) => {
    e.stopPropagation();
    if (onArtistClick && song.artistId) {
      onArtistClick(song.artistId, song.artistName);
    }
  };

  const handleAlbumClick = (e) => {
    e.stopPropagation();
    if (onAlbumClick && song.albumId) {
      onAlbumClick(song.albumId, song.albumName);
    }
  };

  const isClickable = Boolean(onRowClick);
  const hasArtistLink = Boolean(onArtistClick && song.artistId);
  const hasAlbumLink = Boolean(onAlbumClick && song.albumId);

  // Build title with optional track number prefix
  const displayTitle = showTrackNumber && song.trackNumber
    ? `${song.trackNumber}. ${song.title}`
    : song.title || 'Unknown';

  // Determine if we should use custom subtitle or build interactive one
  const useCustomSubtitle = subtitle !== undefined;

  return (
    <div className={styles.cardPadding}>
      <div
        className={`${styles.card} ${isHighlighted ? styles.cardHighlighted : ''} ${isClickable ? styles.cardClickable : ''}`}
        onClick={isClickable ? handleCardClick : undefined}
        onKeyDown={isClickable ? handleKeyDown : undefined}
        tabIndex={isClickable ? 0 : undefined}
        role={isClickable ? 'button' : undefined}
      >
        <div className={styles.cardInfo}>
          <span className={styles.cardTitle}>{displayTitle}</span>
          
          {useCustomSubtitle ? (
            // Custom subtitle - render as plain text
            subtitle && <span className={styles.cardSubtitle}>{subtitle}</span>
          ) : (
            // Default subtitle with clickable artist/album links
            <span className={styles.cardSubtitle}>
              {hasArtistLink ? (
                <button
                  type="button"
                  className={styles.subtitleLink}
                  onClick={handleArtistClick}
                >
                  {song.artistName || 'Unknown'}
                </button>
              ) : (
                <span>{song.artistName || 'Unknown'}</span>
              )}
              
              {song.albumName && (
                <>
                  <span className={styles.subtitleSeparator}> - </span>
                  {hasAlbumLink ? (
                    <button
                      type="button"
                      className={styles.subtitleLink}
                      onClick={handleAlbumClick}
                    >
                      {song.albumName}
                    </button>
                  ) : (
                    <span>{song.albumName}</span>
                  )}
                </>
              )}
            </span>
          )}
        </div>
        
        {renderActions && (
          <div className={styles.cardActions}>
            {renderActions(song)}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(SongTableCard);
