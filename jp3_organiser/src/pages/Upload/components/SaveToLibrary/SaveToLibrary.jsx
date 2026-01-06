/**
 * SaveToLibrary Component
 * 
 * Displays the "Ready to Save" stage of the upload workflow.
 * Shows confirmed files and provides save/back/reset actions.
 * 
 * Playlist modes:
 * - New playlist (playlistId = null): Uses save_to_playlist which saves songs 
 *   to library AND creates a new playlist with those songs.
 * - Existing playlist (playlistId = number): Saves songs to library, then adds
 *   the returned song IDs to the existing playlist.
 * 
 * @param {Object} props
 * @param {string} props.libraryPath - The configured library directory path
 * @param {Object} props.workflow - Workflow machine instance
 * @param {Object} props.toast - Toast instance from parent
 */

import React, { useState, useCallback } from 'react';
import { saveToLibrary, saveToPlaylist, addSongsToPlaylist, MetadataStatus } from '../../../../services';
import { useUploadCache } from '../../../../hooks';
import { UPLOAD_MODE } from '../../../../utils';
import styles from './SaveToLibrary.module.css';

export default function SaveToLibrary({ libraryPath, workflow, toast }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const cache = useUploadCache();
  const { confirmedFiles, removeConfirmedFiles, clearAll, uploadMode, uploadContext } = cache;
  
  const isPlaylistMode = uploadMode === UPLOAD_MODE.PLAYLIST;
  const playlistName = uploadContext?.playlist;
  const playlistId = uploadContext?.playlistId;
  const isExistingPlaylist = isPlaylistMode && playlistId !== null;

  const handleSaveToLibrary = useCallback(async () => {
    if (!libraryPath) {
      setSaveError('Library path not configured');
      return;
    }

    const filesToSave = confirmedFiles.filter(
      f => f.metadataStatus === MetadataStatus.COMPLETE
    );

    if (filesToSave.length === 0) {
      setSaveError('No complete files to add');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      const files = filesToSave.map(f => ({
        sourcePath: f.filePath,
        metadata: f.metadata,
      }));

      let message;
      
      if (isExistingPlaylist) {
        // Existing playlist mode: save to library, then add songs to playlist
        const libraryResult = await saveToLibrary(libraryPath, files);
        
        // Combine newly saved songs AND duplicate songs (which already exist in library)
        // Both should be added to the playlist
        const allSongIds = [
          ...(libraryResult.songIds || []),
          ...(libraryResult.duplicateSongIds || []),
        ];
        
        if (allSongIds.length > 0) {
          await addSongsToPlaylist(libraryPath, playlistId, allSongIds);
        }
        
        const newSongsCount = libraryResult.songIds?.length || 0;
        const duplicatesCount = libraryResult.duplicateSongIds?.length || 0;
        
        message = `Added ${allSongIds.length} song(s) to playlist "${playlistName}". `;
        
        if (newSongsCount > 0) {
          message += `${libraryResult.artistsAdded} artist(s), ${libraryResult.albumsAdded} album(s) added to library. `;
        }
        
        if (duplicatesCount > 0) {
          message += `${duplicatesCount} existing song(s) also added to playlist.`;
        }
      } else if (isPlaylistMode && playlistName) {
        // New playlist mode: save to library AND create playlist
        const result = await saveToPlaylist(libraryPath, playlistName, files);
        
        message = `Created playlist "${result.playlistName}" with ${result.songsAdded} song(s). ` +
          `${result.artistsAdded} artist(s), ${result.albumsAdded} album(s).`;
        
        if (result.duplicatesSkipped > 0) {
          message += ` ${result.duplicatesSkipped} skipped.`;
        }
      } else {
        // Normal mode: save to library only
        const result = await saveToLibrary(libraryPath, files);
        
        message = `Added ${result.filesSaved} file(s) to library. ` +
          `${result.artistsAdded} artist(s), ${result.albumsAdded} album(s), ${result.songsAdded} song(s).`;
        
        if (result.duplicatesSkipped > 0) {
          message += ` ${result.duplicatesSkipped} duplicate(s) skipped.`;
        }
      }

      toast.showToast(message, 'success');
      removeConfirmedFiles();
      workflow.saveComplete();
    } catch (err) {
      setSaveError(`Failed to save to library: ${err}`);
    } finally {
      setIsSaving(false);
    }
  }, [libraryPath, confirmedFiles, removeConfirmedFiles, workflow, toast, isPlaylistMode, isExistingPlaylist, playlistName, playlistId]);

  const handleBackToReview = useCallback(() => {
    const startIndex = confirmedFiles.findIndex(f => !f.isConfirmed);
    workflow.backToReview(startIndex >= 0 ? startIndex : 0);
  }, [workflow, confirmedFiles]);

  const handleReset = useCallback(() => {
    clearAll();
    toast.hideToast();
    setSaveError(null);
  }, [clearAll, toast]);

  return (
    <div className={styles.completeContainer}>
      <div className={styles.completeHeader}>
        <h3 className={styles.completeTitle}>
          {isExistingPlaylist 
            ? 'Ready to Add to Playlist'
            : isPlaylistMode 
              ? 'Ready to Create Playlist' 
              : 'Ready to Add to Library'
          }
        </h3>
        <p className={styles.completeMessage}>
          {isExistingPlaylist
            ? `${confirmedFiles.length} file(s) will be added to playlist "${playlistName}".`
            : isPlaylistMode 
              ? `${confirmedFiles.length} file(s) will create a new playlist "${playlistName}".`
              : `${confirmedFiles.length} file(s) confirmed and ready to be added.`
          }
        </p>
      </div>

      {saveError && (
        <div className={styles.errorMessage}>{saveError}</div>
      )}

      <div className={styles.completeActions}>
        <button
          className={styles.saveButton}
          onClick={handleSaveToLibrary}
          disabled={isSaving}
        >
          {isSaving 
            ? 'Saving...' 
            : isExistingPlaylist
              ? `Add ${confirmedFiles.length} Song(s) to Playlist`
              : isPlaylistMode
                ? `Create Playlist with ${confirmedFiles.length} Song(s)`
                : `Add ${confirmedFiles.length} File(s) to Library`
          }
        </button>

        <button
          className={styles.backButton}
          onClick={handleBackToReview}
          disabled={isSaving}
        >
          Back to Review
        </button>

        <button
          className={styles.resetButton}
          onClick={handleReset}
          disabled={isSaving}
        >
          Start Over
        </button>
      </div>

      {/* Confirmed files list */}
      <div className={styles.confirmedList}>
        <h4 className={styles.confirmedListTitle}>
          {isPlaylistMode ? `Songs for "${playlistName}":` : 'Confirmed Files:'}
        </h4>
        <ul className={styles.fileList}>
          {confirmedFiles.map(file => (
            <li key={file.trackingId} className={styles.fileItem}>
              <span className={styles.fileName}>
                {file.metadata?.title || file.fileName}
              </span>
              <span className={styles.fileMeta}>
                {file.metadata?.artist} - {file.metadata?.album}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
