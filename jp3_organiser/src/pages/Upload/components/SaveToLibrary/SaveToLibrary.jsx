/**
 * SaveToLibrary Component
 * 
 * Displays the "Ready to Save" stage of the upload workflow.
 * Shows confirmed files and provides save/back/reset actions.
 * 
 * @param {Object} props
 * @param {string} props.libraryPath - The configured library directory path
 * @param {Array} props.confirmedFiles - Files that have been confirmed
 * @param {Object} props.workflow - Workflow machine instance
 * @param {Object} props.cache - Upload cache instance
 * @param {Object} props.toast - Toast instance from parent
 * @param {function} props.onSaveComplete - Called after successful save
 */

import React, { useState, useCallback } from 'react';
import { saveToLibrary, MetadataStatus } from '../../../../services';
import styles from './SaveToLibrary.module.css';

export default function SaveToLibrary({ libraryPath, confirmedFiles, workflow, cache, toast, onSaveComplete }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

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

      const result = await saveToLibrary(libraryPath, files);

      let message = `Added ${result.filesSaved} file(s) to library. ` +
        `${result.artistsAdded} artist(s), ${result.albumsAdded} album(s), ${result.songsAdded} song(s).`;
      
      if (result.duplicatesSkipped > 0) {
        message += ` ${result.duplicatesSkipped} duplicate(s) skipped.`;
      }

      toast.showToast(message, 'success');

      cache.removeConfirmedFiles();
      workflow.saveComplete();
      
      if (onSaveComplete) {
        onSaveComplete();
      }
    } catch (err) {
      setSaveError(`Failed to save to library: ${err}`);
    } finally {
      setIsSaving(false);
    }
  }, [libraryPath, confirmedFiles, cache, workflow, toast, onSaveComplete]);

  const handleBackToReview = useCallback(() => {
    const startIndex = confirmedFiles.findIndex(f => !f.isConfirmed);
    workflow.backToReview(startIndex >= 0 ? startIndex : 0);
  }, [workflow, confirmedFiles]);

  const handleReset = useCallback(() => {
    cache.clearAll();
    toast.hideToast();
    setSaveError(null);
  }, [cache, toast]);

  

  return (
    <div className={styles.completeContainer}>
          <div className={styles.completeHeader}>
            <h3 className={styles.completeTitle}>Ready to Add to Library</h3>
            <p className={styles.completeMessage}>
              {cache.confirmedFiles.length} file(s) confirmed and ready to be added.
            </p>
          </div>

          <div className={styles.completeActions}>
            <button
              className={styles.saveButton}
              onClick={handleSaveToLibrary}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : `Add ${cache.confirmedFiles.length} File(s) to Library`}
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
            <h4 className={styles.confirmedListTitle}>Confirmed Files:</h4>
            <ul className={styles.fileList}>
              {cache.confirmedFiles.map(file => (
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
