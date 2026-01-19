/**
 * SongTableRow Component
 * 
 * Memoized table row for SongTable table variant.
 * Displays song info in a traditional table layout.
 * Title, artist, and album names can be clickable links that navigate to detail pages.
 * 
 * Props:
 * - song: Song object with title, artistName, albumName, artistId, albumId
 * - index: Row index (for display number)
 * - isHighlighted: Whether this row should be highlighted
 * - columns: Array of column keys to display
 * - onRowClick: Optional click handler for the row
 * - onTitleClick: Optional callback when song title is clicked
 * - onArtistClick: Optional callback when artist name is clicked
 * - onAlbumClick: Optional callback when album name is clicked
 * - renderActions: Function to render action buttons
 * - showCheckbox: Whether to show selection checkbox
 * - isSelected: Whether this row is selected
 * - onCheckboxToggle: Callback when checkbox is toggled
 */

import React, { memo } from 'react';
import { formatDuration } from '../../utils/formatters';
import styles from './SongTable.module.css';

function SongTableRow({
  song,
  index,
  isHighlighted = false,
  columns = ['title', 'artist', 'album', 'duration'],
  onRowClick,
  onTitleClick,
  onArtistClick,
  onAlbumClick,
  renderActions,
  showCheckbox = false,
  isSelected = false,
  onCheckboxToggle,
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

  const handleTitleClick = (e) => {
    e.stopPropagation();
    if (onTitleClick) {
      onTitleClick(song);
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

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    if (onCheckboxToggle) {
      onCheckboxToggle(e);
    }
  };

  const isClickable = Boolean(onRowClick);
  const hasTitleLink = Boolean(onTitleClick);
  // Check for undefined/null, but allow 0 as a valid ID
  const hasArtistLink = Boolean(onArtistClick) && song.artistId !== undefined && song.artistId !== null;
  const hasAlbumLink = Boolean(onAlbumClick) && song.albumId !== undefined && song.albumId !== null;

  return (
    <tr
      className={`${styles.tableRow} ${isHighlighted ? styles.highlighted : ''} ${isClickable ? styles.clickable : ''} ${isSelected ? styles.selected : ''}`}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? 'button' : undefined}
    >
      {showCheckbox && (
        <td className={styles.cellCheckbox}>
          <input
            type="checkbox"
            className={styles.checkbox}
            checked={isSelected}
            onChange={handleCheckboxClick}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${song.title || 'song'}`}
          />
        </td>
      )}
      <td className={styles.cellIndex}>{index + 1}</td>
      
      {columns.includes('title') && (
        <td className={styles.cellTitle}>
          {hasTitleLink ? (
            <span
              className={styles.cellLink}
              onClick={handleTitleClick}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleClick(e)}
              role="link"
              tabIndex={0}
            >
              {song.title || 'Unknown'}
            </span>
          ) : (
            song.title || 'Unknown'
          )}
        </td>
      )}
      
      {columns.includes('artist') && (
        <td className={styles.cellArtist}>
          {hasArtistLink ? (
            <span
              className={styles.cellLink}
              onClick={handleArtistClick}
              onKeyDown={(e) => e.key === 'Enter' && handleArtistClick(e)}
              role="link"
              tabIndex={0}
            >
              {song.artistName || 'Unknown'}
            </span>
          ) : (
            song.artistName || 'Unknown'
          )}
        </td>
      )}
      
      {columns.includes('album') && (
        <td className={styles.cellAlbum}>
          {hasAlbumLink ? (
            <span
              className={styles.cellLink}
              onClick={handleAlbumClick}
              onKeyDown={(e) => e.key === 'Enter' && handleAlbumClick(e)}
              role="link"
              tabIndex={0}
            >
              {song.albumName || 'Unknown'}
            </span>
          ) : (
            song.albumName || 'Unknown'
          )}
        </td>
      )}
      
      {columns.includes('duration') && (
        <td className={styles.cellDuration}>
          {formatDuration(song.durationSec)}
        </td>
      )}
      
      {columns.includes('path') && (
        <td className={styles.cellPath}>{song.path || ''}</td>
      )}

      {renderActions && (
        <td className={styles.cellActions}>
          {renderActions(song)}
        </td>
      )}
    </tr>
  );
}

export default memo(SongTableRow);
