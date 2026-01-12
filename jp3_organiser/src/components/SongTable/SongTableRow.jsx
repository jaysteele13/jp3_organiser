/**
 * SongTableRow Component
 * 
 * Memoized table row for SongTable table variant.
 * Displays song info in a traditional table layout.
 * 
 * Props:
 * - song: Song object
 * - index: Row index (for display number)
 * - isHighlighted: Whether this row should be highlighted
 * - columns: Array of column keys to display
 * - onRowClick: Optional click handler for the row
 * - renderActions: Function to render action buttons
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
  renderActions,
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

  return (
    <tr
      className={`${styles.tableRow} ${isHighlighted ? styles.highlighted : ''} ${isClickable ? styles.clickable : ''}`}
      onClick={isClickable ? handleClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? 'button' : undefined}
    >
      <td className={styles.cellIndex}>{index + 1}</td>
      
      {columns.includes('title') && (
        <td className={styles.cellTitle}>{song.title || 'Unknown'}</td>
      )}
      
      {columns.includes('artist') && (
        <td className={styles.cellArtist}>{song.artistName || 'Unknown'}</td>
      )}
      
      {columns.includes('album') && (
        <td className={styles.cellAlbum}>{song.albumName || 'Unknown'}</td>
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
