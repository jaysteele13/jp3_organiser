/**
 * ArtistCard Component
 * 
 * A circle-centric artist card where the circular image is the main container.
 * Artist name appears below the circle.
 * 
 * Interaction:
 * - Hover: Shows album/song count overlay
 * - Click: Shows action menu overlay (Go to Artist, Edit, Delete)
 * 
 * @param {Object} props
 * @param {Object} props.artist - Artist object with id and name
 * @param {string} props.libraryPath - Base library path for cover art
 * @param {number} props.albumCount - Number of albums by this artist
 * @param {number} props.songCount - Number of songs by this artist
 * @param {Array} props.actions - Action menu items: { label: string, onClick: function, variant?: 'danger' }
 * @param {number} props.size - Circle diameter in pixels (default: 120)
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { CoverArt, ActionMenu } from '../../components';
import { IMAGE_COVER_TYPE } from '../../utils/enums';
import styles from './ArtistCard.module.css';

const ArtistCard = memo(function ArtistCard({
  artist,
  libraryPath,
  albumCount = 0,
  songCount = 0,
  actions = [],
  size = 120,
}) {
  const [showActions, setShowActions] = useState(false);
  const cardRef = useRef(null);

  // Toggle action menu visibility on click
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    setShowActions(prev => !prev);
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setShowActions(prev => !prev);
    }
    if (e.key === 'Escape') {
      setShowActions(false);
    }
  }, []);

  // Close action menu when clicking outside
  useEffect(() => {
    if (!showActions) return;

    const handleClickOutside = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setShowActions(false);
      }
    };

    // Delay to avoid same-click closure
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActions]);

  return (
    <div className={styles.artistCard} ref={cardRef}>
      <div
        className={styles.circleContainer}
        style={{ width: size, height: size }}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={`View options for ${artist.name}`}
        aria-expanded={showActions}
      >
        <CoverArt
          artist={artist.name}
          libraryPath={libraryPath}
          size="large"
          imageCoverType={IMAGE_COVER_TYPE.ARTIST}
          circular
        />
        
        {/* Hover overlay - shows counts only */}
        <div className={styles.hoverOverlay}>
          <div className={styles.meta}>
            <span>{albumCount} album{albumCount !== 1 ? 's' : ''}</span>
            <span>{songCount} song{songCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Click overlay - shows action menu */}
        {showActions && actions.length > 0 && (
          <div className={styles.actionOverlay}>
            <ActionMenu items={actions} />
          </div>
        )}
      </div>
      
      <span 
        className={styles.artistName}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        {artist.name}
      </span>
    </div>
  );
});

export default ArtistCard;
