/**
 * EditSongModal
 * 
 * Modal dialog for editing song metadata.
 * Reuses MetadataForm from the Upload flow with an adapter.
 * Wraps content with LibraryProvider for autosuggest functionality.
 */

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { LibraryProvider } from '../../../../hooks';
import { parsedSongToTrackedFile } from '../../../../utils';
import MetadataForm from '../../../Upload/components/MetadataForm';
import styles from './EditSongModal.module.css';

export default function EditSongModal({ 
  song,
  libraryPath,
  onSave,
  onCancel,
  isSaving
}) {
  // Track if mousedown started on overlay (not modal content)
  const mouseDownOnOverlay = useRef(false);

  if (!song) {
    return null;
  }

  // Convert ParsedSong to TrackedAudioFile format for MetadataForm
  const trackedFile = parsedSongToTrackedFile(song);

  // Handle form save - convert back to metadata format for the API
  const handleSave = (trackingId, formData) => {
    // formData has: title, artist, album, year (optional)
    onSave(song.id, {
      title: formData.title,
      artist: formData.artist,
      album: formData.album,
      year: formData.year || null,
      // Preserve existing values
      trackNumber: song.trackNumber,
      durationSecs: song.durationSec,
    });
  };

  // Only close if both mousedown and mouseup happened on overlay
  const handleOverlayMouseDown = (e) => {
    if (e.target === e.currentTarget) {
      mouseDownOnOverlay.current = true;
    }
  };

  const handleOverlayMouseUp = (e) => {
    if (e.target === e.currentTarget && mouseDownOnOverlay.current) {
      onCancel();
    }
    mouseDownOnOverlay.current = false;
  };

  return createPortal(
    <div 
      className={styles.overlay} 
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
    >
      <div className={styles.modal}>
        <h2 className={styles.title}>Edit Song Metadata</h2>
        
        <p className={styles.info}>
          Update the metadata for this song. The audio file will not be modified.
        </p>

        <LibraryProvider libraryPath={libraryPath}>
          <div className={styles.formWrapper}>
            <MetadataForm
              file={trackedFile}
              onSave={handleSave}
              onCancel={onCancel}
              yearReadOnly={true}
              alwaysEnableSuggestions={true}
              disableFilenameSuggestions={true}
            />
          </div>
        </LibraryProvider>

        {isSaving && (
          <div className={styles.savingOverlay}>
            <span>Saving...</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
