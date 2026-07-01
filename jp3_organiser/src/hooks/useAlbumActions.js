import { useState, useCallback } from 'react';
import { useEntityModal } from './useEntityModal';
import { deleteAlbum, editAlbum } from '../services/libraryService';
import { pluralize } from '../utils/pluralize';

export function useAlbumActions(libraryPath, handleRefresh, toast) {
  const albumDelete = useEntityModal();
  const albumEdit = useEntityModal();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleDeleteAlbumRequest = useCallback(
    (album) => {
      albumDelete.open(album);
    },
    [albumDelete]
  );

  const handleConfirmDeleteAlbum = useCallback(async () => {
    if (!albumDelete.item || !libraryPath) return;

    setIsDeleting(true);
    try {
      const result = await deleteAlbum(libraryPath, albumDelete.item.id);
      albumDelete.close();
      handleRefresh();
      toast.showToast(
        `Deleted album "${result.albumName}" (${pluralize(result.songsDeleted, 'song')})`,
        'success'
      );
    } catch (err) {
      console.error('Failed to delete album:', err);
      toast.showToast('Failed to delete album', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [albumDelete, libraryPath, handleRefresh, toast]);

  const handleCancelDeleteAlbum = useCallback(() => {
    albumDelete.close();
  }, [albumDelete]);

  const handleEditAlbumRequest = useCallback(
    (album) => {
      albumEdit.open(album);
    },
    [albumEdit]
  );

  const handleConfirmEditAlbum = useCallback(
    async (albumId, newName, newArtistName, newYear) => {
      if (!libraryPath) return;

      setIsSaving(true);
      try {
        const result = await editAlbum(libraryPath, albumId, newName, newArtistName, newYear);
        albumEdit.close();
        handleRefresh();

        const messages = [`Album updated: "${result.oldName}" → "${result.newName}"`];
        if (result.artistCreated) messages.push('new artist created');
        messages.push(`${pluralize(result.songsUpdated, 'song')} updated`);
        toast.showToast(messages.join(', '), 'success');
      } catch (err) {
        console.error('Failed to edit album:', err);
        toast.showToast(err.toString() || 'Failed to edit album', 'error');
      } finally {
        setIsSaving(false);
      }
    },
    [albumEdit, libraryPath, handleRefresh, toast]
  );

  const handleCancelEditAlbum = useCallback(() => {
    if (isSaving) return;
    albumEdit.close();
  }, [albumEdit, isSaving]);

  return {
    albumDelete,
    albumEdit,
    isDeleting,
    isSaving,
    handleDeleteAlbumRequest,
    handleConfirmDeleteAlbum,
    handleCancelDeleteAlbum,
    handleEditAlbumRequest,
    handleConfirmEditAlbum,
    handleCancelEditAlbum,
  };
}

export default useAlbumActions;
