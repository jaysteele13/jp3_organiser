/**
 * SongTableCard Component
 * 
 * Memoized card-style row for SongTable card variant.
 * Displays song info in a horizontal card layout (like Spotify).
 * 
 * Props:
 * - song: Song object
 * - isHighlighted: Whether this card should be highlighted (e.g., currently playing)
 * - onRowClick: Optional click handler for the card
 * - renderActions: Function to render action buttons
 * - showTrackNumber: Show track number prefix in title
 * - subtitle: Custom subtitle (defaults to "artist - album")
 */

import React, { memo } from 'react';
import styles from './SongTable.module.css';

function SongTableCard({
  song,
  isHighlighted = false,
  onRowClick,
  renderActions,
  showTrackNumber = false,
  subtitle,
}) {
  const handleClick = () => {
    if (onRowClick) {
      onRowClick(song);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onRowClick) {
      onRowClick(song);
    }
  };

  const isClickable = Boolean(onRowClick);

  // Build title with optional track number prefix
  const displayTitle = showTrackNumber && song.trackNumber
    ? `${song.trackNumber}. ${song.title}`
    : song.title || 'Unknown';

  // Build subtitle: use custom if provided, otherwise default to artist - album
  const displaySubtitle = subtitle !== undefined
    ? subtitle
    : `${song.artistName || 'Unknown'}${song.albumName ? ` - ${song.albumName}` : ''}`;

  return (
    <div className={styles.cardPadding}>
      <div
        className={`${styles.card} ${isHighlighted ? styles.cardHighlighted : ''} ${isClickable ? styles.cardClickable : ''}`}
        onClick={isClickable ? handleClick : undefined}
        onKeyDown={isClickable ? handleKeyDown : undefined}
        tabIndex={isClickable ? 0 : undefined}
        role={isClickable ? 'button' : undefined}
      >
        <div className={styles.cardInfo}>
          <span className={styles.cardTitle}>{displayTitle}</span>
          {displaySubtitle && (
            <span className={styles.cardSubtitle}>{displaySubtitle}</span>
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
