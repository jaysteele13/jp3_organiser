/**
 * useCoverActions Hook
 *
 * Opens the "Edit Cover Art" picker for an album or artist and reacts to its outcome:
 * redraws the cover and shows a toast.
 *
 * @param {string} libraryPath - Base library path
 * @param {Object} toast - Toast controls from useToast
 */

import { useCallback } from 'react';
import { useEntityModal } from './useEntityModal';
import { refreshCover } from '../components/CoverArt';
import { COVER_KIND } from '../utils/enums';

export function useCoverActions(libraryPath, toast) {
  // The item is the picker's target: { kind, artist, album }
  const { item: coverTarget, open, close } = useEntityModal();

  const handleEditAlbumCoverRequest = useCallback(
    (album) => open({ kind: COVER_KIND.ALBUM, artist: album.artistName, album: album.name }),
    [open]
  );

  const handleEditArtistCoverRequest = useCallback(
    (artist) => open({ kind: COVER_KIND.ARTIST, artist: artist.name, album: null }),
    [open]
  );

  const handleCoverSaved = useCallback(() => {
    refreshCover(libraryPath, coverTarget.artist, coverTarget.album);
    close();
    toast.showToast('Cover art updated', 'success');
  }, [libraryPath, coverTarget, close, toast]);

  const handleCoverError = useCallback(
    (err) => {
      console.error('Failed to update cover art:', err);
      toast.showToast('Failed to update cover art', 'error');
    },
    [toast]
  );

  return {
    coverTarget,
    handleEditAlbumCoverRequest,
    handleEditArtistCoverRequest,
    handleCoverSaved,
    handleCoverError,
    handleCancelCoverEdit: close,
  };
}

export default useCoverActions;
