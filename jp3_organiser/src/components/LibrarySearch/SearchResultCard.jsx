/**
 * SearchResultCard Component
 * 
 * Displays a single search result with appropriate icon/cover art.
 * - Playlists: Show playlist icon
 * - Artists: Show artist cover art (circular)
 * - Albums: Show album cover art
 * - Songs: Show music note icon (no cover art for now)
 */

import { memo } from 'react';
import { CoverArt } from '../../components';
import { IMAGE_COVER_TYPE } from '../../utils/enums';
import { SEARCH_CATEGORY } from '../../hooks/useLibrarySearch';
import playlistPlaceholder from '../../assets/icon_placeholder/playlist_placeholder.png';
import styles from './LibrarySearch.module.css';

const SearchResultCard = memo(function SearchResultCard({
  item,
  libraryPath,
  isHighlighted,
  onClick,
}) {
  const { category } = item;
  
  const handleClick = () => {
    onClick?.(item);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(item);
    }
  };
  
  // Render thumbnail based on category
  const renderThumbnail = () => {
    switch (category) {
      case SEARCH_CATEGORY.PLAYLIST:
        return (
          <div className={styles.iconThumbnail}>
            <img src={playlistPlaceholder} alt="Playlist" className={styles.icon} />
          </div>
        );
      
      case SEARCH_CATEGORY.ARTIST:
        return (
          <CoverArt
            artist={item.name}
            libraryPath={libraryPath}
            size="small"
            imageCoverType={IMAGE_COVER_TYPE.ARTIST}
          />
        );
      
      case SEARCH_CATEGORY.ALBUM:
        return (
          <CoverArt
            artist={item.artistName}
            album={item.name}
            libraryPath={libraryPath}
            size="small"
            imageCoverType={IMAGE_COVER_TYPE.ALBUM}
          />
        );
      
      case SEARCH_CATEGORY.SONG:
        return (
          <div className={styles.iconThumbnail}>
            <span className={styles.icon}>🎵</span>
          </div>
        );
      
      default:
        return null;
    }
  };
  
  // Get title and subtitle based on category
  const getDisplayInfo = () => {
    switch (category) {
      case SEARCH_CATEGORY.PLAYLIST:
        return {
          title: item.name,
          subtitle: `${item.songCount || 0} song${item.songCount !== 1 ? 's' : ''}`,
        };
      
      case SEARCH_CATEGORY.ARTIST:
        return {
          title: item.name,
          subtitle: 'Artist',
        };
      
      case SEARCH_CATEGORY.ALBUM:
        return {
          title: item.name,
          subtitle: item.artistName,
        };
      
      case SEARCH_CATEGORY.SONG:
        return {
          title: item.title,
          subtitle: `${item.artistName}${item.albumName ? ` • ${item.albumName}` : ''}`,
        };
      
      default:
        return { title: '', subtitle: '' };
    }
  };
  
  const { title, subtitle } = getDisplayInfo();
  
  return (
    <div
      className={`${styles.resultCard} ${isHighlighted ? styles.highlighted : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="option"
      aria-selected={isHighlighted}
      tabIndex={0}
    >
      <div className={styles.thumbnail}>
        {renderThumbnail()}
      </div>
      <div className={styles.resultInfo}>
        <div className={styles.resultTitle}>{title}</div>
        <div className={styles.resultSubtitle}>{subtitle}</div>
      </div>
    </div>
  );
});

export default SearchResultCard;
