/**
 * PlaylistCover Component
 *
 * The square picture for a playlist. Shows the image the user uploaded if there
 * is one; otherwise it is built from the album covers of the playlist's songs
 * (see collageAlbums): four covers in a 2x2 grid, two side by side, or one.
 * A playlist with no album covers to show gets the playlist placeholder.
 *
 * @param {Object} props
 * @param {number} props.playlistId - Playlist ID (finds the uploaded image)
 * @param {Array} props.songs - The playlist's songs, in order
 * @param {string} props.libraryPath - Base library path
 * @param {'small'|'medium'|'large'|'xlarge'} [props.size] - Same sizes as CoverArt; leave out to fill the parent's width
 * @param {string} [props.className] - Additional CSS class
 */

import { useState, useEffect, useMemo, memo } from 'react';
import CoverArt, { COVER_SIZES } from '../CoverArt';
import { getCoverBlobUrl } from '../../services/coverArtService';
import { COVER_KIND } from '../../utils/enums';
import { collageAlbums } from '../../utils/playlistCovers';
import playlistPlaceholder from '../../assets/icon_placeholder/playlist_placeholder.png';
import styles from './PlaylistCover.module.css';

// Uploaded images already looked up this session: key -> Promise of a blob URL, or of null if there is none
const uploadedCovers = new Map();
const COVER_UPDATED_EVENT = 'playlistcover-updated';

const makeKey = (libraryPath, playlistId) => `${libraryPath}:${playlistId}`;

const TILE_CLASSES = { 2: styles.two, 4: styles.four };

const PlaylistCover = memo(function PlaylistCover({ playlistId, songs, libraryPath, size, className = '' }) {
  // undefined while looking, null when the user has not uploaded an image
  const [uploadedUrl, setUploadedUrl] = useState(undefined);
  const [reloadCount, setReloadCount] = useState(0);
  const albums = useMemo(() => collageAlbums(songs), [songs]);
  const key = makeKey(libraryPath, playlistId);

  useEffect(() => {
    const handleUpdated = (event) => {
      if (event.detail === key) setReloadCount((count) => count + 1);
    };
    window.addEventListener(COVER_UPDATED_EVENT, handleUpdated);
    return () => window.removeEventListener(COVER_UPDATED_EVENT, handleUpdated);
  }, [key]);

  useEffect(() => {
    if (!libraryPath || playlistId == null) return undefined;

    let isCurrent = true;
    if (!uploadedCovers.has(key)) {
      uploadedCovers.set(key, getCoverBlobUrl(libraryPath, COVER_KIND.PLAYLIST, String(playlistId)));
    }
    uploadedCovers.get(key).then((url) => {
      if (isCurrent) setUploadedUrl(url);
    });

    return () => {
      isCurrent = false;
    };
  }, [key, libraryPath, playlistId, reloadCount]);

  const sizeValue = COVER_SIZES[size];
  const containerClass = [styles.cover, !uploadedUrl && TILE_CLASSES[albums.length], className]
    .filter(Boolean)
    .join(' ');

  let content = null;
  if (uploadedUrl) {
    content = <img src={uploadedUrl} alt="Playlist cover" className={styles.image} />;
  } else if (uploadedUrl === null && albums.length > 0) {
    content = albums.map(({ artist, album }) => (
      <CoverArt key={`${artist}|||${album}`} artist={artist} album={album} libraryPath={libraryPath} fill />
    ));
  } else if (uploadedUrl === null) {
    content = <img src={playlistPlaceholder} alt="Playlist" className={styles.image} />;
  }

  return (
    <div className={containerClass} style={sizeValue && { width: sizeValue, minWidth: sizeValue }}>
      {content}
    </div>
  );
});

export default PlaylistCover;

/**
 * Forget a playlist's uploaded image and make every PlaylistCover showing it load it again.
 * Call this after the image was replaced or removed on disk.
 *
 * @param {string} libraryPath - Base library path
 * @param {number|string} playlistId - Playlist ID
 */
export function refreshPlaylistCover(libraryPath, playlistId) {
  const key = makeKey(libraryPath, playlistId);

  uploadedCovers.get(key)?.then((staleUrl) => staleUrl && URL.revokeObjectURL(staleUrl));
  uploadedCovers.delete(key);

  window.dispatchEvent(new CustomEvent(COVER_UPDATED_EVENT, { detail: key }));
}

/**
 * Forget every uploaded image looked up this session.
 * Call this after the cover cache was cleared on disk.
 */
export function clearPlaylistCoverCache() {
  for (const lookup of uploadedCovers.values()) {
    lookup.then((url) => url && URL.revokeObjectURL(url));
  }
  uploadedCovers.clear();
}
