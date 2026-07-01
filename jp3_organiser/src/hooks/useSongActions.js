import { useState, useCallback } from 'react';
import { useEntityModal } from './useEntityModal';
import { deleteSongs, editSongMetadata } from '../services/libraryService';

export function useSongActions(libraryPath, handleRefresh, toast) {
  const songDelete = useEntityModal();
  const songEdit = useEntityModal();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleDeleteSongRequest = useCallback(
    (song) => {
      songDelete.open([song]);
    },
    [songDelete]
  );

  const handleDeleteSongsRequest = useCallback(
    (songs) => {
      songDelete.open(songs);
    },
    [songDelete]
  );

  const handleConfirmDeleteSong = useCallback(async () => {
    const songsToDelete = songDelete.item ?? [];
    if (songsToDelete.length === 0 || !libraryPath) return;

    setIsDeleting(true);
    try {
      const songIds = songsToDelete.map((song) => song.id);
      await deleteSongs(libraryPath, songIds);
      songDelete.close();
      handleRefresh();
    } catch (err) {
      console.error('Failed to delete songs:', err);
      toast.showToast('Failed to delete song', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [libraryPath, songDelete, handleRefresh, toast, setIsDeleting]);

  const handleCancelDeleteSong = useCallback(() => {
    if (isDeleting) return;
    songDelete.close();
  }, [isDeleting, songDelete]);

  const handleEditRequest = useCallback(
    (song) => {
      songEdit.open(song);
    },
    [songEdit]
  );

  const handleConfirmEdit = useCallback(
    async (songId, metadata) => {
      if (!libraryPath) return;

      setIsSaving(true);
      try {
        const result = await editSongMetadata(libraryPath, songId, metadata);
        songEdit.close();
        handleRefresh();

        const messages = ['Song updated'];
        if (result.artistCreated) messages.push('new artist created');
        if (result.albumCreated) messages.push('new album created');
        if (result.playlistsUpdated > 0) {
          messages.push(`${result.playlistsUpdated} playlist${result.playlistsUpdated > 1 ? 's' : ''} updated`);
        }
        toast.showToast(messages.join(', '), 'success');
      } catch (err) {
        console.error('Failed to edit song:', err);
        toast.showToast('Failed to edit song', 'error');
      } finally {
        setIsSaving(false);
      }
    },
    [libraryPath, songEdit, handleRefresh, toast, setIsSaving]
  );

  const handleCancelEdit = useCallback(() => {
    if (isSaving) return;
    songEdit.close();
  }, [isSaving, songEdit]);

  return {
    songDelete,
    songEdit,
    isDeleting,
    isSaving,
    handleDeleteSongRequest,
    handleDeleteSongsRequest,
    handleConfirmDeleteSong,
    handleCancelDeleteSong,
    handleEditRequest,
    handleConfirmEdit,
    handleCancelEdit,
  };
}

export default useSongActions;
