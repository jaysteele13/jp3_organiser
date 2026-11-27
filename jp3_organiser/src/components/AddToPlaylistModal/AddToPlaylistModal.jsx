/**
 * AddToPlaylistModal
 *
 * Popup for adding one song to an existing playlist. Pick a playlist from the
 * searchable dropdown, then it reports "Added to X" or "Already in X".
 *
 * @param {Object} props
 * @param {Object} props.song - The song to add: { id, title, artistName }
 * @param {function} props.onClose - Called when the popup should close
 */

import { useEffect, useState } from 'react';
import { useLibraryConfig } from '../../hooks/useLibraryConfig';
import { invalidateLibraryCache } from '../../hooks/libraryCache';
import { addSongsToPlaylist, listPlaylists } from '../../services/libraryService';
import ConfirmModal from '../ConfirmModal';
import PlaylistComboBox from '../PlaylistComboBox';
import styles from './AddToPlaylistModal.module.css';

export default function AddToPlaylistModal({ song, onClose }) {
  const { libraryPath } = useLibraryConfig();
  const [playlists, setPlaylists] = useState(null); // null = still loading
  const [selected, setSelected] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!libraryPath) return;
    let cancelled = false;
    listPlaylists(libraryPath)
      .catch(() => [])
      .then((found) => !cancelled && setPlaylists(found));
    return () => { cancelled = true; };
  }, [libraryPath]);

  const handleSelect = (playlist) => {
    setSelected(playlist);
    setMessage('');
  };

  const handleAdd = async () => {
    if (!selected) return setMessage('Choose a playlist first');

    setIsSaving(true);
    try {
      // The backend skips songs the playlist already has, so 0 added means it was there
      const { songsAdded } = await addSongsToPlaylist(libraryPath, selected.id, [song.id]);
      // The cached library holds each playlist's songs; drop it so pages reload the change
      if (songsAdded) invalidateLibraryCache(libraryPath);
      setMessage(`${songsAdded ? 'Added to' : 'Already in'} "${selected.name}"`);
      setIsDone(true);
    } catch (err) {
      console.error('Failed to add song to playlist:', err);
      setMessage('Failed to add song to playlist');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ConfirmModal
      title="Add to Playlist"
      message={`"${song.title}" by ${song.artistName || 'Unknown'}`}
      confirmLabel={isDone ? 'Done' : 'Add'}
      cancelLabel={isDone ? '' : 'Cancel'}
      onConfirm={isDone ? onClose : handleAdd}
      onCancel={onClose}
      isLoading={isSaving}
    >
      {!isDone && (
        // Tall enough for the open dropdown, so the popup does not have to scroll
        <div className={styles.picker}>
          <PlaylistComboBox
            playlists={playlists ?? []}
            selectedPlaylist={selected}
            onSelect={handleSelect}
            isLoading={playlists === null}
          />
        </div>
      )}
      {message && <p className={styles.message} role="status">{message}</p>}
    </ConfirmModal>
  );
}
