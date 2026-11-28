/**
 * useCoverActions Hook
 *
 * Opens the "Edit Cover Art" picker for an album, artist or playlist and reacts to its outcome:
 * redraws the cover and shows a toast.
 *
 * @param {string} libraryPath - Base library path
 * @param {Object} toast - Toast controls from useToast
 */

import { useCallback } from 'react';
import { useEntityModal } from './useEntityModal';
import { refreshCover } from '../components/CoverArt';
import { refreshPlaylistCover } from '../components/PlaylistCover';
import { COVER_KIND } from '../utils/enums';

export function useCoverActions(libraryPath, toast) {
  // The item is the picker's target: { kind, artist, album }, plus the name for a playlist
  const { item: coverTarget, open, close } = useEntityModal();

  const handleEditAlbumCoverRequest = useCallback(
    (album) => open({ kind: COVER_KIND.ALBUM, artist: album.artistName, album: album.name }),
    [open]
  );

  const handleEditArtistCoverRequest = useCallback(
    (artist) => open({ kind: COVER_KIND.ARTIST, artist: artist.name, album: null }),
    [open]
  );

  // A playlist's cover is saved under its ID, which is passed where the artist name goes
  const handleEditPlaylistCoverRequest = useCallback(
    (playlist) => open({ kind: COVER_KIND.PLAYLIST, artist: String(playlist.id), album: null, name: playlist.name }),
    [open]
  );

  const handleCoverSaved = useCallback(() => {
    if (coverTarget.kind === COVER_KIND.PLAYLIST) {
      refreshPlaylistCover(libraryPath, coverTarget.artist);
    } else {
      refreshCover(libraryPath, coverTarget.artist, coverTarget.album);
    }
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
    handleEditPlaylistCoverRequest,
    handleCoverSaved,
    handleCoverError,
    handleCancelCoverEdit: close,
  };
}

export default useCoverActions;
