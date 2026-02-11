/**
 * CoverArt Component
 * 
 * Reusable cover art display with lazy loading and fallback.
 * Fetches cover art from cache or external API on first render.
 * 
 * For albums: Uses Cover Art Archive via MusicBrainz Release IDs
 * For artists: Uses Deezer API by artist name
 * 
 * External API calls are throttled through a global queue (500ms between calls)
 * to avoid overwhelming endpoints, especially after a cache clear.
 * 
 * Props:
 * - artist: string - Artist name (required)
 * - album: string - Album name (required for album covers, omit for artist covers)
 * - libraryPath: string - Base library path
 * - size: 'small' | 'medium' | 'large' | 'xlarge' - Thumbnail size (40px, 60px, 120px, 250px)
 * - className: string - Additional CSS class
 * - fallbackIcon: string - Emoji to show when no cover available (ignored for artist covers)
 * - imageCoverType: IMAGE_COVER_TYPE - Whether to fetch album or artist cover
 * - circular: boolean - Whether to render as a circle (default: false, auto-true for artist covers)
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
import { getAlbumMbids } from '../../services/mbidStore';
import {
  isAlbumCoverNotFound,
  isArtistCoverNotFound,
  markAlbumCoverNotFound,
  markArtistCoverNotFound,
} from '../../services/coverArtNotFoundStore';
import { IMAGE_COVER_TYPE } from '../../utils/enums';
import styles from './CoverArt.module.css';

// Artist placeholder images
import artistPlaceholder0 from '../../assets/artist_placeholders/0.png';
import artistPlaceholder1 from '../../assets/artist_placeholders/1.png';
import artistPlaceholder2 from '../../assets/artist_placeholders/2.png';
import artistPlaceholder3 from '../../assets/artist_placeholders/3.png';

// Album placeholder image
import albumPlaceholder from '../../assets/icon_placeholder/album_placeholder.png';



// Size configurations
const SIZES = {
  small: 60,
  medium: 90,
  large: 150,
  xlarge: 250,
};

// Artist fallback placeholder images
const ARTIST_PLACEHOLDER_IMAGES = [
  artistPlaceholder0,
  artistPlaceholder1,
  artistPlaceholder2,
  artistPlaceholder3,
];

/**
 * Get a consistent fallback placeholder image for an artist based on their name
 * Uses a simple hash to ensure the same artist always gets the same placeholder
 */
function getArtistPlaceholderImage(artistName) {
  const name = (artistName || '').toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % ARTIST_PLACEHOLDER_IMAGES.length;
  return ARTIST_PLACEHOLDER_IMAGES[index];
}

// Cache for blob URLs to avoid re-fetching during session
// Key format: "libraryPath:artist|||album" for albums, "libraryPath:artist|||" for artists
const blobUrlCache = new Map();

// Track in-flight requests to deduplicate concurrent fetches
// Key format same as blobUrlCache, value is a Promise
const inFlightRequests = new Map();

// ── Proxy error event ──
// Fires a debounced custom event when the CoverArtArchive returns a 5xx error
// so the View page can show a single toast instead of one per cover.
let lastProxyErrorTime = 0;
const PROXY_ERROR_COOLDOWN_MS = 30_000; // Only emit once per 30s

function emitProxyError(statusText) {
  const now = Date.now();
  if (now - lastProxyErrorTime < PROXY_ERROR_COOLDOWN_MS) return;
  lastProxyErrorTime = now;
  window.dispatchEvent(new CustomEvent('coverart-proxy-error', { detail: statusText }));
}

/**
 * Check if an error string indicates a server-side (5xx) proxy/gateway issue
 */
function isProxyError(errorString) {
  return errorString && /Request failed: HTTP 5\d{2}/i.test(errorString);
}

// ── Global throttle queue for external API calls ──
// Ensures only one cover art API call runs at a time with 500ms between calls.
// Disk cache reads bypass this queue.
const THROTTLE_DELAY_MS = 500;
let fetchQueue = Promise.resolve();

/**
 * Queue an external API call through the global throttle.
 * Returns the result of the callback.
 * @param {() => Promise<T>} fn - Async function making the external API call
 * @returns {Promise<T>}
 */
function throttledFetch(fn) {
  const queued = fetchQueue.then(async () => {
    const result = await fn();
    // Wait 500ms before the next queued call can start
    await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY_MS));
    return result;
  });
  // Chain the next call after this one (including the delay)
  // Use .catch to prevent one failure from breaking the chain
  fetchQueue = queued.catch(() => {});
  return queued;
}

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
  borderRadius = false,
  imageCoverType = IMAGE_COVER_TYPE.ALBUM,
  circular = null, // null = auto (circular for artists, square for albums)
}) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const sizeValue = SIZES[size] || SIZES.medium;
  const isArtistCover = imageCoverType === IMAGE_COVER_TYPE.ARTIST;
  
  // Auto-determine circular: true for artists, false for albums (unless explicitly set)
  const isCircular = circular !== null ? circular : isArtistCover;
  
  // Use artist-specific fallback placeholder for artist covers
  const artistPlaceholder = isArtistCover ? getArtistPlaceholderImage(artist) : null;

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

      // Check if there's already an in-flight request for this cover
      if (inFlightRequests.has(cacheKey)) {
        try {
          const blobUrl = await inFlightRequests.get(cacheKey);
          if (isMounted) {
            setImageUrl(blobUrl);
            setHasError(!blobUrl);
            setIsLoading(false);
          }
        } catch (error) {
          if (isMounted) {
            setHasError(true);
            setIsLoading(false);
          }
        }
        return;
      }

      setIsLoading(true);
      setHasError(false);

      // Create the fetch promise and store it
      const fetchPromise = (async () => {
        try {
          // Try to read from disk cache first
          let blobUrl = await getAlbumCoverBlobUrl(libraryPath, artist, album);

          // If not cached, check if previously marked as not found
          if (!blobUrl) {
            const notFound = await isAlbumCoverNotFound(artist, album);
            if (notFound) {
              console.log('[CoverArt] Album cover previously not found, skipping API call:', artist, '-', album);
              return null;
            }

            // Look up MBIDs and fetch from API (throttled)
            console.log('[CoverArt] No cached album cover, looking up MBIDs...');
            const { mbid, acoustidMbid } = await getAlbumMbids(artist, album);
            console.log('[CoverArt] Album MBID:', mbid, '| AcoustID fallback:', acoustidMbid);

            if (mbid) {
              const result = await throttledFetch(() =>
                fetchAlbumCover(libraryPath, artist, album, mbid, acoustidMbid)
              );
              console.log('[CoverArt] fetchAlbumCover result:', result);
              if (result.success) {
                blobUrl = await getAlbumCoverBlobUrl(libraryPath, artist, album);
              } else if (isProxyError(result.error)) {
                // 5xx — transient server issue, don't mark as not found
                emitProxyError(result.error);
              } else {
                // Genuine not-found — cache to avoid repeated API calls
                await markAlbumCoverNotFound(artist, album);
              }
            } else {
              // No MBID available, mark as not found
              await markAlbumCoverNotFound(artist, album);
            }
          }

          if (blobUrl) {
            blobUrlCache.set(cacheKey, blobUrl);
          }

          return blobUrl;
        } finally {
          // Clean up in-flight tracking
          inFlightRequests.delete(cacheKey);
        }
      })();

      inFlightRequests.set(cacheKey, fetchPromise);

      try {
        const blobUrl = await fetchPromise;
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

      // Check if there's already an in-flight request for this cover
      if (inFlightRequests.has(cacheKey)) {
        try {
          const blobUrl = await inFlightRequests.get(cacheKey);
          if (isMounted) {
            setImageUrl(blobUrl);
            setHasError(!blobUrl);
            setIsLoading(false);
          }
        } catch (error) {
          if (isMounted) {
            setHasError(true);
            setIsLoading(false);
          }
        }
        return;
      }

      setIsLoading(true);
      setHasError(false);

      // Create the fetch promise and store it
      const fetchPromise = (async () => {
        try {
          // Try to read from disk cache first
          let blobUrl = await getArtistCoverBlobUrl(libraryPath, artist);

          // If not cached, check if previously marked as not found
          if (!blobUrl) {
            const notFound = await isArtistCoverNotFound(artist);
            if (notFound) {
              console.log('[CoverArt] Artist cover previously not found, skipping API call:', artist);
              return null;
            }

            // Fetch from Deezer (throttled)
            console.log('[CoverArt] No cached artist cover, fetching from Deezer...');

            {
              const result = await throttledFetch(() =>
                fetchArtistCover(libraryPath, artist)
              );
              console.log('[CoverArt] fetchArtistCover result:', result);
              if (result.success) {
                blobUrl = await getArtistCoverBlobUrl(libraryPath, artist);
              } else if (isProxyError(result.error)) {
                // 5xx — transient server issue, don't mark as not found
                emitProxyError(result.error);
              } else {
                // Genuine not-found — cache to avoid repeated API calls
                await markArtistCoverNotFound(artist);
              }
            }
          }

          if (blobUrl) {
            blobUrlCache.set(cacheKey, blobUrl);
          }

          return blobUrl;
        } finally {
          // Clean up in-flight tracking
          inFlightRequests.delete(cacheKey);
        }
      })();

      inFlightRequests.set(cacheKey, fetchPromise);

      try {
        const blobUrl = await fetchPromise;
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

  const containerClass = [
    styles.container,
    styles[size],
    isCircular ? styles.circular : '',
    !borderRadius ? styles.noRadius : '',
    className,
  ].filter(Boolean).join(' ');
  
  const altText = isArtistCover ? `${artist} artist image` : `${album} album cover`;

  // Show fallback while loading, on error, or when no image
  if (isLoading || hasError || !imageUrl) {
    // For artists, use placeholder image; for albums, use album placeholder image
    if (isArtistCover && artistPlaceholder) {
      return (
        <div className={containerClass} style={containerStyle}>
          <img
            src={artistPlaceholder}
            alt={`${artist} placeholder`}
            className={styles.image}
          />
        </div>
      );
    }

    if (imageCoverType === IMAGE_COVER_TYPE.SONG) {
      return (
        <div className={containerClass} style={containerStyle}>
          <img
            src={songPlaceholder}
            alt={`${album} song placeholder`}
            className={styles.image}
          />
        </div>
      );
    }

    return (
      <div className={containerClass} style={containerStyle}>
        <img
          src={albumPlaceholder}
          alt={`${album} placeholder`}
          className={styles.image}
        />
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
  inFlightRequests.clear();
  // Reset the throttle queue so pending items from the old cache don't pile up
  fetchQueue = Promise.resolve();
}
