/**
 * ArtistCard Component
 * 
 * A circle-centric artist card where the circular image is the main container.
 * Artist name appears below the circle.
 * On hover, an overlay shows song/album count and action menu.
 * 
 * @param {Object} props
 * @param {Object} props.artist - Artist object with id and name
 * @param {string} props.libraryPath - Base library path for cover art
 * @param {number} props.albumCount - Number of albums by this artist
 * @param {number} props.songCount - Number of songs by this artist
 * @param {Function} props.onClick - Callback when artist is clicked
 * @param {Array} props.actions - Action menu items: { label: string, onClick: function, variant?: 'danger' }
 * @param {number} props.size - Circle diameter in pixels (default: 120)
 */

import { memo, useCallback } from 'react';
import { CoverArt, ActionMenu } from '../../components';
import { IMAGE_COVER_TYPE } from '../../utils/enums';
import styles from './ArtistCard.module.css';

const ArtistCard = memo(function ArtistCard({
  artist,
  libraryPath,
  albumCount = 0,
  songCount = 0,
  onClick,
  actions = [],
  size = 120,
}) {
  const handleClick = useCallback(() => {
    onClick?.(artist);
  }, [onClick, artist]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(artist);
    }
  }, [onClick, artist]);

  // Prevent click propagation from action menu
  const handleOverlayClick = useCallback((e) => {
    e.stopPropagation();
  }, []);

  return (
    <div className={styles.artistCard}>
       {actions.length > 0 && (
            <div className={styles.actions}>
              <ActionMenu items={actions} />
            </div>
          )}
      <div
        className={styles.circleContainer}
        style={{ width: size, height: size }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`View ${artist.name}`}
      >
        
        <CoverArt
          artist={artist.name}
          libraryPath={libraryPath}
          size="large"
          imageCoverType={IMAGE_COVER_TYPE.ARTIST}
          circular
        />
        
        {/* Hover overlay with meta and actions */}
        <div className={styles.overlay} onClick={handleOverlayClick}>
          <div className={styles.meta}>
            <span>{albumCount} album{albumCount !== 1 ? 's' : ''}</span>
            <span>{songCount} song{songCount !== 1 ? 's' : ''}</span>
          </div>
         
        </div>
      </div>
      
      <span 
        className={styles.artistName}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="link"
        tabIndex={0}
      >
        {artist.name}
      </span>
    </div>
  );
});

export default ArtistCard;
