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
import { saveToLibrary, saveToPlaylist, addSongsToPlaylist, MetadataStatus, setMbids } from '../../../../services';
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

  /**
   * Store MBIDs for albums after saving to library.
   * Maps each file's releaseMbid to the corresponding albumId from the result.
   * @param {Array} filesToSave - Files that were saved
   * @param {Array} albumIds - Album IDs returned from save operation (parallel array)
   */
  const storeMbids = useCallback(async (filesToSave, albumIds) => {
    console.log('[SaveToLibrary] storeMbids called');
    console.log('[SaveToLibrary] albumIds from result:', albumIds);
    console.log('[SaveToLibrary] filesToSave count:', filesToSave?.length);
    
    // Log each file's metadata to see what MBIDs we have
    filesToSave?.forEach((file, i) => {
      console.log(`[SaveToLibrary] File ${i}: "${file.metadata?.title}" by "${file.metadata?.artist}"`);
      console.log(`[SaveToLibrary]   Album: "${file.metadata?.album}"`);
      console.log(`[SaveToLibrary]   releaseMbid: ${file.metadata?.releaseMbid || 'NOT SET'}`);
      console.log(`[SaveToLibrary]   albumId from result: ${albumIds?.[i]}`);
    });
    
    if (!albumIds || albumIds.length === 0) {
      console.log('[SaveToLibrary] No albumIds returned from save operation!');
      return;
    }
    
    const entries = [];
    for (let i = 0; i < filesToSave.length && i < albumIds.length; i++) {
      const mbid = filesToSave[i].metadata?.releaseMbid;
      const albumId = albumIds[i];
      if (mbid && albumId !== undefined && albumId !== null) {
        entries.push({ albumId, mbid });
      } else {
        console.log(`[SaveToLibrary] Skipping file ${i}: mbid=${mbid}, albumId=${albumId}`);
      }
    }
    
    if (entries.length > 0) {
      console.log('[SaveToLibrary] Storing MBIDs:', entries);
      await setMbids(entries);
    } else {
      console.log('[SaveToLibrary] No valid MBID entries to store!');
    }
  }, []);

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
        
        // Store MBIDs for cover art fetching
        await storeMbids(filesToSave, libraryResult.albumIds);
        
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
        
        // Store MBIDs for cover art fetching
        await storeMbids(filesToSave, result.albumIds);
        
        message = `Created playlist "${result.playlistName}" with ${result.songsAdded} song(s). ` +
          `${result.artistsAdded} artist(s), ${result.albumsAdded} album(s).`;
        
        if (result.duplicatesSkipped > 0) {
          message += ` ${result.duplicatesSkipped} skipped.`;
        }
      } else {
        // Normal mode: save to library only
        const result = await saveToLibrary(libraryPath, files);
        
        // Store MBIDs for cover art fetching
        await storeMbids(filesToSave, result.albumIds);
        
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
  }, [libraryPath, confirmedFiles, removeConfirmedFiles, workflow, toast, isPlaylistMode, isExistingPlaylist, playlistName, playlistId, storeMbids]);

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
