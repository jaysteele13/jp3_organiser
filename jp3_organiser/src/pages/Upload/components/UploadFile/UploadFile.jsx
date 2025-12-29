/**
 * UploadFile Component
 * 
 * Orchestrates the complete audio file upload workflow:
 * 1. User selects files -> ProcessFile handles selection and processing
 * 2. Once processed, user enters ReviewScreen to confirm metadata
 * 3. After confirmation, files can be saved to library
 * 
 * @param {Object} props
 * @param {string} props.libraryPath - The configured library directory path
 */

import React, { useState, useCallback } from 'react';
import ProcessFile from '../ProcessFile';
import ReviewScreen from '../ReviewScreen';
import { useUploadCache } from '../../../../hooks';
import { saveToLibrary, MetadataStatus } from '../../../../services';
import styles from './UploadFile.module.css';

/**
 * Workflow stages
 */
const Stage = {
  PROCESS: 'process',   // File selection and processing
  REVIEW: 'review',     // Reviewing and confirming metadata
  COMPLETE: 'complete', // All files confirmed, ready to save
};

export default function UploadFile({ libraryPath }) {
  const cache = useUploadCache();
  const [stage, setStage] = useState(Stage.PROCESS);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Handle starting review from ProcessFile
  const handleStartReview = useCallback(() => {
    setStage(Stage.REVIEW);
  }, []);

  // Handle file confirmation in ReviewScreen
  const handleConfirmFile = useCallback((trackingId) => {
    cache.confirmFile(trackingId);
  }, [cache]);

  // Handle file removal in ReviewScreen
  const handleRemoveFile = useCallback((trackingId) => {
    cache.removeFile(trackingId);
  }, [cache]);

  // Handle file edit in ReviewScreen
  const handleEditFile = useCallback((trackingId, metadata) => {
    cache.updateFileMetadata(trackingId, metadata);
    // Also confirm after edit
    cache.confirmFile(trackingId);
  }, [cache]);

  // Handle review completion (all files confirmed)
  const handleReviewComplete = useCallback(() => {
    setStage(Stage.COMPLETE);
  }, []);

  // Handle exit from review
  const handleExitReview = useCallback(() => {
    setStage(Stage.PROCESS);
  }, []);

  // Save confirmed files to library
  const handleSaveToLibrary = useCallback(async () => {
    if (!libraryPath) {
      setSaveError('Library path not configured');
      return;
    }

    const filesToSave = cache.confirmedFiles.filter(
      f => f.metadataStatus === MetadataStatus.COMPLETE
    );

    if (filesToSave.length === 0) {
      setSaveError('No complete files to add');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      setSuccessMessage(null);

      const files = filesToSave.map(f => ({
        sourcePath: f.filePath,
        metadata: f.metadata,
      }));

      const result = await saveToLibrary(libraryPath, files);

      setSuccessMessage(
        `Added ${result.filesSaved} file(s) to library. ` +
        `${result.artistsAdded} artist(s), ${result.albumsAdded} album(s), ${result.songsAdded} song(s).`
      );

      // Clear saved files from cache
      cache.removeConfirmedFiles();
      
      // Reset to process stage
      setStage(Stage.PROCESS);
    } catch (err) {
      setSaveError(`Failed to save to library: ${err}`);
    } finally {
      setIsSaving(false);
    }
  }, [libraryPath, cache]);

  // Reset everything
  const handleReset = useCallback(() => {
    cache.clearAll();
    setStage(Stage.PROCESS);
    setSuccessMessage(null);
    setSaveError(null);
  }, [cache]);

  // Render based on current stage
  return (
    <div className={styles.uploadContainer}>
      {/* Success message */}
      {successMessage && (
        <div className={styles.successMessage}>{successMessage}</div>
      )}

      {/* Save error */}
      {saveError && (
        <div className={styles.error}>{saveError}</div>
      )}

      {/* Process stage - file selection and processing */}
      {stage === Stage.PROCESS && (
        <ProcessFile onStartReview={handleStartReview} />
      )}

      {/* Review stage - confirming metadata */}
      {stage === Stage.REVIEW && (
        <ReviewScreen
          files={cache.trackedFiles}
          onComplete={handleReviewComplete}
          onExit={handleExitReview}
          onConfirmFile={handleConfirmFile}
          onRemoveFile={handleRemoveFile}
          onEditFile={handleEditFile}
        />
      )}

      {/* Complete stage - ready to save */}
      {stage === Stage.COMPLETE && (
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
              onClick={() => setStage(Stage.REVIEW)}
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
      )}
    </div>
  );
}
