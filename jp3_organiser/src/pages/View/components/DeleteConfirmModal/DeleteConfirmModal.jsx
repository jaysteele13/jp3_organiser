/**
 * DeleteConfirmModal
 * 
 * Modal dialog to confirm song deletion.
 * Shows the songs to be deleted and handles the delete action.
 */

import { useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './DeleteConfirmModal.module.css';

export default function DeleteConfirmModal({ 
  songs, 
  onConfirm, 
  onCancel,
  isDeleting 
}) {
  if (!songs || songs.length === 0) {
    return null;
  }

  const isSingleSong = songs.length === 1;

  return createPortal(
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>
          Delete {isSingleSong ? 'Song' : `${songs.length} Songs`}?
        </h2>
        
        <p className={styles.warning}>
          This action will mark the {isSingleSong ? 'song' : 'songs'} as deleted. 
          The file{isSingleSong ? '' : 's'} will remain on disk until you compact the library.
        </p>

        <div className={styles.songList}>
          {songs.slice(0, 5).map((song) => (
            <div key={song.id} className={styles.songItem}>
              <span className={styles.songTitle}>{song.title}</span>
              <span className={styles.songArtist}>{song.artistName}</span>
            </div>
          ))}
          {songs.length > 5 && (
            <div className={styles.moreItems}>
              ...and {songs.length - 5} more
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button 
            className={styles.cancelBtn} 
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button 
            className={styles.deleteBtn} 
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
