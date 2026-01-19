/**
 * ArtistCard Component
 * 
 * A circle-centric artist card where the circular image is the main container.
 * Artist name appears below the circle.
 * 
 * Interaction:
 * - Hover: Shows album/song count overlay
 * - Click: If onClick prop provided, calls it directly. Otherwise shows action menu overlay.
 * - Right-click: Shows context menu with "View in Library" option (if onViewInLibrary provided).
 * 
 * @param {Object} props
 * @param {Object} props.artist - Artist object with id and name
 * @param {string} props.libraryPath - Base library path for cover art
 * @param {number} props.albumCount - Number of albums by this artist
 * @param {number} props.songCount - Number of songs by this artist
 * @param {Array} props.actions - Action menu items: { label: string, onClick: function, variant?: 'danger' }
 * @param {Function} props.onClick - Direct click handler (bypasses action menu if provided)
 * @param {Function} props.onViewInLibrary - Callback for "View in Library" context menu action
 * @param {number} props.size - Circle diameter in pixels (default: 120)
 * @param {string} props.coverSize - CoverArt size: 'small' | 'medium' | 'large' | 'xlarge' (default: 'large')
 * @param {string} props.variant - Style variant: 'default' | 'purple' (default: 'default')
 */

import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { CoverArt, ScrollingText, ContextMenu } from '../../components';
import { IMAGE_COVER_TYPE } from '../../utils/enums';
import styles from './ArtistCard.module.css';

const ArtistCard = memo(function ArtistCard({
  artist,
  libraryPath,
  albumCount = 0,
  songCount = 0,
  actions = [],
  onClick,
  onViewInLibrary,
  size = 120,
  coverSize = 'large',
  variant = 'default',
}) {
  const [showActions, setShowActions] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  const cardRef = useRef(null);

  // Context menu handlers
  const handleContextMenu = useCallback((e) => {
    if (!onViewInLibrary) return; // Only show if handler provided
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  }, [onViewInLibrary]);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  // Handle click - direct navigation if onClick provided, otherwise toggle action menu
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (onClick) {
      onClick(artist);
    } else {
      setShowActions(prev => !prev);
    }
  }, [onClick, artist]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onClick) {
        onClick(artist);
      } else {
        setShowActions(prev => !prev);
      }
    }
    if (e.key === 'Escape') {
      setShowActions(false);
    }
  }, [onClick, artist]);

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

  // Handle action item click
  const handleActionClick = useCallback((e, action) => {
    e.stopPropagation();
    setShowActions(false);
    action.onClick?.();
  }, []);

  const circleClass = variant === 'purple' 
    ? `${styles.circleContainer} ${styles.purpleVariant}`
    : styles.circleContainer;

  return (
    <div className={styles.artistCard} ref={cardRef}>
      {/* Circle wrapper - allows action overlay to escape circle clipping */}
      <div className={styles.circleWrapper} style={{ width: size, height: size }}>
        <div
          className={circleClass}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`View options for ${artist.name}`}
          aria-expanded={showActions}
        >
          <CoverArt
            artist={artist.name}
            libraryPath={libraryPath}
            size={coverSize}
            imageCoverType={IMAGE_COVER_TYPE.ARTIST}
            circular
          />
          
          {/* Hover overlay - shows counts only */}
          {!showActions && (
            <div className={styles.hoverOverlay}>
              <div className={styles.meta}>
                <span>{albumCount} album{albumCount !== 1 ? 's' : ''}</span>
                <span>{songCount} song{songCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          )}
        </div>

        {/* Action overlay - positioned above circle */}
        {showActions && actions.length > 0 && (
          <div className={styles.actionOverlay}>
            <div className={styles.actionList}>
              {actions.map((action, index) => (
                <button
                  key={index}
                  className={`${styles.actionButton} ${action.variant === 'danger' ? styles.dangerButton : ''}`}
                  onClick={(e) => handleActionClick(e, action)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <ScrollingText
        className={styles.artistName}
        containerClassName={styles.artistNameContainer}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
      >
        {artist.name}
      </ScrollingText>
      
      {onViewInLibrary && (
        <ContextMenu
          visible={contextMenu.visible}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          items={[
            { label: 'View in Library', onClick: () => onViewInLibrary(artist) }
          ]}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
});

export default ArtistCard;
