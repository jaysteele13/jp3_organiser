/**
 * AddToPlaylistModal
 *
 * Popup for adding one or more songs to an existing playlist. Pick a playlist from the
 * searchable dropdown, then it reports how many were added and how many were already there.
 *
 * @param {Object} props
 * @param {Object} [props.song] - A single song to add: { id, title, artistName }
 * @param {Array} [props.songs] - Several songs to add (use instead of song)
 * @param {function} props.onClose - Called when the popup should close
 */

import { useEffect, useState } from 'react';
import { useLibraryConfig } from '../../hooks/useLibraryConfig';
import { getCachedLibrary, invalidateLibraryCache, setCachedLibrary } from '../../hooks/libraryCache';
import { addSongsToPlaylist, listPlaylists } from '../../services/libraryService';
import { addSongsToPlaylistList, withPlaylistNames } from '../../utils/songFilter';
import { pluralize } from '../../utils/pluralize';
import ConfirmModal from '../ConfirmModal';
import PlaylistComboBox from '../PlaylistComboBox';
import styles from './AddToPlaylistModal.module.css';

// The cached library holds each playlist's songs. Add the songs there too, so the next page
// that reads the cache sees them and the "/" bar keeps its name suggestions.
function addToCachedPlaylist(libraryPath, playlistId, songIds) {
  const cached = getCachedLibrary(libraryPath);
  if (!cached?.playlists) return invalidateLibraryCache(libraryPath);

  const playlists = addSongsToPlaylistList(cached.playlists, playlistId, songIds);
  setCachedLibrary(libraryPath, { ...cached, playlists, songs: withPlaylistNames(cached.songs, playlists) });
}

// The backend skips songs the playlist already has, so fewer added than sent means some were there
function resultMessage(added, total, name) {
  if (total === 1) return `${added ? 'Added to' : 'Already in'} "${name}"`;
  if (added === total) return `Added ${pluralize(total, 'song')} to "${name}"`;
  if (!added) return `All ${total} songs are already in "${name}"`;
  return `Added ${added} of ${total} songs to "${name}" (${total - added} already there)`;
}

export default function AddToPlaylistModal({ song, songs = [song], onClose }) {
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
      const songIds = songs.map((item) => item.id);
      const { songsAdded } = await addSongsToPlaylist(libraryPath, selected.id, songIds);
      if (songsAdded) addToCachedPlaylist(libraryPath, selected.id, songIds);
      setMessage(resultMessage(songsAdded, songs.length, selected.name));
      setIsDone(true);
    } catch (err) {
      console.error('Failed to add to playlist:', err);
      setMessage('Failed to add to playlist');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ConfirmModal
      title="Add to Playlist"
      message={songs.length === 1
        ? `"${songs[0].title}" by ${songs[0].artistName || 'Unknown'}`
        : pluralize(songs.length, 'song')}
      confirmLabel={isDone ? 'Done' : 'Add'}
      cancelLabel={isDone ? '' : 'Cancel'}
      onConfirm={isDone ? onClose : handleAdd}
      onCancel={onClose}
      isLoading={isSaving}
    >
      {!isDone && (
        // Grows while the dropdown is open, so the popup does not have to scroll
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
