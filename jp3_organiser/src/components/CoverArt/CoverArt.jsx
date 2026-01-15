/**
 * CoverArt Component
 * 
 * Reusable cover art display with lazy loading and fallback.
 * Fetches cover art from cache or external API on first render.
 * 
 * For albums: Uses Cover Art Archive via MusicBrainz Release IDs
 * For artists: Uses Fanart.tv via MusicBrainz Artist IDs
 * 
 * Props:
 * - artist: string - Artist name (required)
 * - album: string - Album name (required for album covers, omit for artist covers)
 * - libraryPath: string - Base library path
 * - size: 'small' | 'medium' | 'large' | 'xlarge' - Thumbnail size (40px, 60px, 120px, 250px)
 * - className: string - Additional CSS class
 * - fallbackIcon: string - Emoji to show when no cover available
 * - imageCoverType: IMAGE_COVER_TYPE - Whether to fetch album or artist cover
 * 
 * Note: Cover files are named using a hash for stability across library compaction.
 */

import { useState, useEffect, memo } from 'react';
import { 
  getAlbumCoverBlobUrl, 
  getArtistCoverBlobUrl,
  fetchAlbumCover,
  fetchArtistCover 
} from '../../services/coverArtService';
import { getAlbumMbid, getArtistMbid } from '../../services/mbidStore';
import { IMAGE_COVER_TYPE } from '../../utils/enums';
import styles from './CoverArt.module.css';

// Size configurations
const SIZES = {
  small: 40,
  medium: 60,
  large: 120,
  xlarge: 250,
};

// Cache for blob URLs to avoid re-fetching during session
// Key format: "libraryPath:artist|||album" for albums, "libraryPath:artist|||" for artists
const blobUrlCache = new Map();

/**
 * Create a stable cache key for album covers
 */
function makeAlbumCacheKey(libraryPath, artist, album) {
  const normalizedArtist = (artist || '').toLowerCase().trim();
  const normalizedAlbum = (album || '').toLowerCase().trim();
  return `album:${libraryPath}:${normalizedArtist}|||${normalizedAlbum}`;
}

/**
 * Create a stable cache key for artist covers
 */
function makeArtistCacheKey(libraryPath, artist) {
  const normalizedArtist = (artist || '').toLowerCase().trim();
  return `artist:${libraryPath}:${normalizedArtist}`;
}

const CoverArt = memo(function CoverArt({
  artist,
  album = null,
  libraryPath,
  size = 'medium',
  className = '',
  fallbackIcon = '💿',
  imageCoverType = IMAGE_COVER_TYPE.ALBUM,
}) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const sizeValue = SIZES[size] || SIZES.medium;
  const isArtistCover = imageCoverType === IMAGE_COVER_TYPE.ARTIST;

  useEffect(() => {
    let isMounted = true;

    async function loadAlbumCover() {
      if (!libraryPath || !artist || !album) {
        setIsLoading(false);
        setHasError(true);
        return;
      }

      const cacheKey = makeAlbumCacheKey(libraryPath, artist, album);

      // Check in-memory cache first
      if (blobUrlCache.has(cacheKey)) {
        const cachedUrl = blobUrlCache.get(cacheKey);
        if (cachedUrl) {
          if (isMounted) {
            setImageUrl(cachedUrl);
            setIsLoading(false);
            setHasError(false);
          }
          return;
        }
      }

      setIsLoading(true);
      setHasError(false);

      try {
        // Try to read from disk cache first
        let blobUrl = await getAlbumCoverBlobUrl(libraryPath, artist, album);

        // If not cached, look up MBID and fetch from API
        if (!blobUrl) {
          console.log('[CoverArt] No cached album cover, looking up MBID...');
          const mbid = await getAlbumMbid(artist, album);
          console.log('[CoverArt] Album MBID:', mbid);

          if (mbid) {
            const result = await fetchAlbumCover(libraryPath, artist, album, mbid);
            console.log('[CoverArt] fetchAlbumCover result:', result);
            if (result.success) {
              blobUrl = await getAlbumCoverBlobUrl(libraryPath, artist, album);
            }
          }
        }

        if (blobUrl) {
          blobUrlCache.set(cacheKey, blobUrl);
        }

        if (isMounted) {
          setImageUrl(blobUrl);
          setHasError(!blobUrl);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[CoverArt] Failed to load album cover:', error);
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    }

    async function loadArtistCover() {
      if (!libraryPath || !artist) {
        setIsLoading(false);
        setHasError(true);
        return;
      }

      const cacheKey = makeArtistCacheKey(libraryPath, artist);

      // Check in-memory cache first
      if (blobUrlCache.has(cacheKey)) {
        const cachedUrl = blobUrlCache.get(cacheKey);
        if (cachedUrl) {
          if (isMounted) {
            setImageUrl(cachedUrl);
            setIsLoading(false);
            setHasError(false);
          }
          return;
        }
      }

      setIsLoading(true);
      setHasError(false);

      try {
        // Try to read from disk cache first
        let blobUrl = await getArtistCoverBlobUrl(libraryPath, artist);

        // If not cached, look up artist MBID and fetch from Fanart.tv
        if (!blobUrl) {
          console.log('[CoverArt] No cached artist cover, looking up artist MBID...');
          const artistMbid = await getArtistMbid(artist);
          console.log('[CoverArt] Artist MBID:', artistMbid);

          if (artistMbid) {
            const result = await fetchArtistCover(libraryPath, artist, artistMbid);
            console.log('[CoverArt] fetchArtistCover result:', result);
            if (result.success) {
              blobUrl = await getArtistCoverBlobUrl(libraryPath, artist);
            }
          }
        }

        if (blobUrl) {
          blobUrlCache.set(cacheKey, blobUrl);
        }

        if (isMounted) {
          setImageUrl(blobUrl);
          setHasError(!blobUrl);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[CoverArt] Failed to load artist cover:', error);
        if (isMounted) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    }

    // Call the appropriate loader based on cover type
    if (isArtistCover) {
      loadArtistCover();
    } else {
      loadAlbumCover();
    }

    return () => {
      isMounted = false;
    };
  }, [artist, album, libraryPath, isArtistCover]);

  const containerStyle = {
    width: sizeValue,
    height: sizeValue,
    minWidth: sizeValue,
    minHeight: sizeValue,
  };

  const containerClass = `${styles.container} ${styles[size]} ${className}`;
  const altText = isArtistCover ? `${artist} artist image` : `${album} album cover`;

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
        alt={altText}
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
