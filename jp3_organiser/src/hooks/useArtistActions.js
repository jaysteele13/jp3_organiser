import { useState, useCallback } from 'react';
import { useEntityModal } from './useEntityModal';
import { deleteArtist, editArtist } from '../services/libraryService';
import { invalidateLibraryCache } from './libraryCache';
import { pluralize } from '../utils/pluralize';

export function useArtistActions(libraryPath, handleRefresh, toast) {
  const artistDelete = useEntityModal();
  const artistEdit = useEntityModal();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleDeleteArtistRequest = useCallback(
    (artist) => {
      artistDelete.open(artist);
    },
    [artistDelete]
  );

  const handleConfirmDeleteArtist = useCallback(async () => {
    if (!artistDelete.item || !libraryPath) return;

    setIsDeleting(true);
    try {
      const result = await deleteArtist(libraryPath, artistDelete.item.id);
      invalidateLibraryCache(libraryPath);
      artistDelete.close();
      handleRefresh();
      toast.showToast(
        `Deleted artist "${result.artistName}" (${pluralize(result.songsDeleted, 'song')}, ${pluralize(result.albumsAffected, 'album')})`,
        'success'
      );
    } catch (err) {
      console.error('Failed to delete artist:', err);
      toast.showToast('Failed to delete artist', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [artistDelete, libraryPath, handleRefresh, toast]);

  const handleCancelDeleteArtist = useCallback(() => {
    artistDelete.close();
  }, [artistDelete]);

  const handleEditArtistRequest = useCallback(
    (artist) => {
      artistEdit.open(artist);
    },
    [artistEdit]
  );

  const handleConfirmEditArtist = useCallback(
    async (artistId, newName) => {
      if (!libraryPath) return;

      setIsSaving(true);
      try {
        const result = await editArtist(libraryPath, artistId, newName);
        invalidateLibraryCache(libraryPath);
        artistEdit.close();
        handleRefresh();
        toast.showToast(
          `Artist updated: "${result.oldName}" → "${result.newName}" (${pluralize(result.songsAffected, 'song')}, ${pluralize(result.albumsAffected, 'album')})`,
          'success'
        );
      } catch (err) {
        console.error('Failed to edit artist:', err);
        toast.showToast(err.toString() || 'Failed to edit artist', 'error');
      } finally {
        setIsSaving(false);
      }
    },
    [artistEdit, libraryPath, handleRefresh, toast]
  );

  const handleCancelEditArtist = useCallback(() => {
    if (isSaving) return;
    artistEdit.close();
  }, [artistEdit, isSaving]);

  return {
    artistDelete,
    artistEdit,
    isDeleting,
    isSaving,
    handleDeleteArtistRequest,
    handleConfirmDeleteArtist,
    handleCancelDeleteArtist,
    handleEditArtistRequest,
    handleConfirmEditArtist,
    handleCancelEditArtist,
  };
}

export default useArtistActions;
