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
 * @param {Function} props.getActions - Function to get action menu items for an artist
 * @param {Function} props.onArtistClick - Direct click handler for artist cards (bypasses action menu)
 * @param {string} props.emptyMessage - Message to show when no artists
 * @param {number} props.cardSize - Size of each artist card circle in pixels (default: 120)
 * @param {string} props.coverSize - CoverArt size: 'small' | 'medium' | 'large' | 'xlarge' (default: 'large')
 * @param {string} props.variant - Style variant: 'default' | 'purple' (default: 'default')
 */

import { memo } from 'react';
import ArtistCard from '../ArtistCard';
import styles from './ArtistGrid.module.css';

const ArtistGrid = memo(function ArtistGrid({
  artists = [],
  libraryPath,
  artistCounts = {},
  getActions,
  onArtistClick,
  emptyMessage = 'No artists',
  cardSize = 120,
  coverSize = 'large',
  variant = 'default',
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
            actions={getActions?.(artist) || []}
            onClick={onArtistClick}
            size={cardSize}
            coverSize={coverSize}
            variant={variant}
          />
        );
      })}
    </div>
  );
});

export default ArtistGrid;
