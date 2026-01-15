/**
 * ArtistGrid Component
 * 
 * A responsive grid layout for displaying ArtistCard components.
 * Handles the layout and empty state, delegating individual card rendering to ArtistCard.
 * 
 * @param {Object} props
 * @param {Array} props.artists - Array of artist objects
 * @param {string} props.libraryPath - Base library path for cover art
 * @param {Object} props.artistCounts - Map of artistId -> { albums: number, songs: number }
 * @param {Function} props.onArtistClick - Callback when artist is clicked
 * @param {Function} props.getActions - Function to get action menu items for an artist
 * @param {string} props.emptyMessage - Message to show when no artists
 * @param {number} props.cardSize - Size of each artist card circle (default: 120)
 */

import { memo } from 'react';
import ArtistCard from '../ArtistCard';
import styles from './ArtistGrid.module.css';

const ArtistGrid = memo(function ArtistGrid({
  artists = [],
  libraryPath,
  artistCounts = {},
  onArtistClick,
  getActions,
  emptyMessage = 'No artists',
  cardSize = 120,
}) {
  if (artists.length === 0) {
    return <div className={styles.emptyState}>{emptyMessage}</div>;
  }

  return (
    <div className={styles.grid}>
      {artists.map((artist) => {
        const counts = artistCounts[artist.id] || { albums: 0, songs: 0 };
        return (
          <ArtistCard
            key={artist.id}
            artist={artist}
            libraryPath={libraryPath}
            albumCount={counts.albums}
            songCount={counts.songs}
            onClick={onArtistClick}
            actions={getActions?.(artist) || []}
            size={cardSize}
          />
        );
      })}
    </div>
  );
});

export default ArtistGrid;
