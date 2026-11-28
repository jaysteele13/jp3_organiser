/**
 * PlaylistCoverEditor Component
 *
 * The playlist's picture on the Manage page. Right-click it and choose
 * "Change Playlist Picture" to open the "Edit Cover Art" picker.
 *
 * @param {Object} props
 * @param {{id: number, name: string}} props.playlist - The playlist being managed
 * @param {Array} props.songs - The playlist's songs, in order
 * @param {string} props.libraryPath - Base library path
 */

import { useState } from 'react';
import { ContextMenu, CoverArtPicker, PlaylistCover, Toast } from '../../../../components';
import { useToast } from '../../../../hooks';
import { useCoverActions } from '../../../../hooks/useCoverActions';

export default function PlaylistCoverEditor({ playlist, songs, libraryPath }) {
  const [menuPosition, setMenuPosition] = useState(null);
  const toast = useToast();
  const { coverTarget, handleEditPlaylistCoverRequest, handleCoverSaved, handleCoverError, handleCancelCoverEdit } =
    useCoverActions(libraryPath, toast);

  const handleContextMenu = (event) => {
    event.preventDefault();
    setMenuPosition({ x: event.clientX, y: event.clientY });
  };

  return (
    <>
      <div onContextMenu={handleContextMenu} title="Right-click to change the playlist picture">
        <PlaylistCover playlistId={playlist.id} songs={songs} libraryPath={libraryPath} size="large" />
      </div>

      <ContextMenu
        visible={menuPosition !== null}
        position={menuPosition ?? undefined}
        items={[{ label: 'Change Playlist Picture', onClick: () => handleEditPlaylistCoverRequest(playlist) }]}
        onClose={() => setMenuPosition(null)}
      />

      {coverTarget && (
        <CoverArtPicker
          libraryPath={libraryPath}
          target={coverTarget}
          onSaved={handleCoverSaved}
          onError={handleCoverError}
          onCancel={handleCancelCoverEdit}
        />
      )}

      <Toast message={toast.message} variant={toast.variant} visible={toast.visible} onDismiss={toast.hideToast} />
    </>
  );
}
