/**
 * EditSongModal
 * 
 * Modal dialog for editing song metadata.
 * Reuses MetadataForm from the Upload flow with an adapter.
 * Wraps content with LibraryProvider for autosuggest functionality.
 */

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

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
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
            />
          </div>
        </LibraryProvider>

        {isSaving && (
          <div className={styles.savingOverlay}>
            <span>Saving...</span>
          </div>
        )}
      </div>
    </div>
  );
}
