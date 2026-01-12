/**
 * CoverArt Component
 * 
 * Reusable album cover art display with lazy loading and fallback.
 * Fetches cover art from cache or Cover Art Archive on first render.
 * 
 * Props:
 * - albumId: number - Album ID to fetch cover for
 * - libraryPath: string - Base library path
 * - size: 'small' | 'medium' | 'large' - Thumbnail size (40px, 60px, 120px)
 * - className: string - Additional CSS class
 * - fallbackIcon: string - Emoji to show when no cover available
 * 
 * Note: MBIDs are looked up from the mbidStore automatically.
 */

import { useState, useEffect, memo } from 'react';
import { getCoverBlobUrl, fetchAlbumCover } from '../../services/coverArtService';
import { getMbid } from '../../services/mbidStore';
import styles from './CoverArt.module.css';

// Size configurations
const SIZES = {
  small: 40,
  medium: 60,
  large: 120,
};

// Cache for blob URLs to avoid re-fetching during session
const blobUrlCache = new Map();

const CoverArt = memo(function CoverArt({
  albumId,
  libraryPath,
  size = 'medium',
  className = '',
  fallbackIcon = '💿',
}) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const sizeValue = SIZES[size] || SIZES.medium;

  useEffect(() => {
    let isMounted = true;

    async function loadCover() {
      // Check for missing props - albumId can be 0 which is valid, so use explicit check
      if (!libraryPath || albumId === undefined || albumId === null) {
        setIsLoading(false);
        setHasError(true);
        return;
      }

      // Check in-memory cache first - only use cache if we have a valid URL
      // (don't cache failures, so we can retry when MBID becomes available)
      const cacheKey = `${libraryPath}:${albumId}`;
      if (blobUrlCache.has(cacheKey)) {
        const cachedUrl = blobUrlCache.get(cacheKey);
        // Only use cache if it has a valid URL (not null)
        if (cachedUrl) {
          if (isMounted) {
            setImageUrl(cachedUrl);
            setIsLoading(false);
            setHasError(false);
          }
          return;
        }
        // If cached as null, proceed to check if we now have an MBID
      }

      setIsLoading(true);
      setHasError(false);

      try {
        // First try to get from local cache (file on disk)
        let blobUrl = await getCoverBlobUrl(libraryPath, albumId);

        // If not cached, look up MBID from store and try to fetch
        if (!blobUrl) {
          const mbid = await getMbid(albumId);
          
          if (mbid) {
            const result = await fetchAlbumCover(libraryPath, albumId, mbid);
            if (result.success) {
              // Now try to get the blob URL again
              blobUrl = await getCoverBlobUrl(libraryPath, albumId);
            }
          }
        }

        // Only cache successful results (actual blob URLs)
        // Don't cache null - allows retry when MBID becomes available
        if (blobUrl) {
          blobUrlCache.set(cacheKey, blobUrl);
        }

        if (isMounted) {
          setImageUrl(blobUrl);
          setHasError(!blobUrl);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[CoverArt] Failed to load cover art:', error);
        // Don't cache errors - allows retry
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    }

    loadCover();

    return () => {
      isMounted = false;
    };
  }, [albumId, libraryPath]);

  const containerStyle = {
    width: sizeValue,
    height: sizeValue,
    minWidth: sizeValue,
    minHeight: sizeValue,
  };

  const containerClass = `${styles.container} ${styles[size]} ${className}`;

  // Show fallback icon while loading, on error, or when no image
  if (isLoading || hasError || !imageUrl) {
    return (
      <div className={containerClass} style={containerStyle}>
        <span className={styles.fallback}>{fallbackIcon}</span>
      </div>
    );
  }

  return (
    <div className={containerClass} style={containerStyle}>
      <img
        src={imageUrl}
        alt="Album cover"
        className={styles.image}
        loading="lazy"
      />
    </div>
  );
});

export default CoverArt;

/**
 * Clear the in-memory blob URL cache
 * Call this when the library changes or on logout
 */
export function clearCoverArtCache() {
  // Revoke all blob URLs to free memory
  for (const url of blobUrlCache.values()) {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
  blobUrlCache.clear();
}
