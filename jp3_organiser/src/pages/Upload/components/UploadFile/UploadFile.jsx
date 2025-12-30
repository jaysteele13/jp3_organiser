/**
 * UploadFile Component
 * 
 * Orchestrates the complete audio file upload workflow:
 * 1. User selects files -> ProcessFile handles selection and processing
 * 2. Once processed, user enters ReviewScreen to confirm metadata
 * 3. After confirmation, files can be saved to library
 * 4. User can go back to re-review all files before saving
 * 
 * Workflow state is persisted in cache so navigation doesn't lose progress.
 * 
 * @param {Object} props
 * @param {string} props.libraryPath - The configured library directory path
 * @param {Object} props.library - Parsed library data for autosuggest
 */

import React, { useState, useCallback } from 'react';
import ProcessFile from '../ProcessFile';
import ReviewScreen from '../ReviewScreen';
import { useUploadCache, UploadStage } from '../../../../hooks';
import { saveToLibrary, MetadataStatus } from '../../../../services';
import styles from './UploadFile.module.css';

export default function UploadFile({ libraryPath, library }) {
  const cache = useUploadCache();
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Get workflow state from cache
  const { stage, reviewAll, reviewIndex, isEditMode } = cache.workflowState;

  // Helper to update stage
  const setStage = useCallback((newStage) => {
    cache.updateWorkflowState({ stage: newStage });
  }, [cache]);

  // Helper to update reviewAll
  const setReviewAll = useCallback((value) => {
    cache.updateWorkflowState({ reviewAll: value });
  }, [cache]);

  // Handle starting review from ProcessFile
  const handleStartReview = useCallback(() => {
    cache.updateWorkflowState({ 
      stage: UploadStage.REVIEW, 
      reviewAll: false,
      reviewIndex: 0,
      isEditMode: false,
    });
  }, [cache]);

  // Handle file confirmation in ReviewScreen
  const handleConfirmFile = useCallback((trackingId) => {
    cache.confirmFile(trackingId);
  }, [cache]);

  // Handle file unconfirmation in ReviewScreen (re-review mode)
  const handleUnconfirmFile = useCallback((trackingId) => {
    cache.unconfirmFile(trackingId);
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
    setStage(UploadStage.COMPLETE);
  }, [setStage]);

  // Handle exit from review
  const handleExitReview = useCallback(() => {
    // If in reviewAll mode and all files are confirmed, go to complete
    if (reviewAll && cache.allFilesConfirmed) {
      setStage(UploadStage.COMPLETE);
    } else {
      setStage(UploadStage.PROCESS);
    }
    setReviewAll(false);
  }, [reviewAll, cache.allFilesConfirmed, setStage, setReviewAll]);

  // Handle going back to review from complete stage
  const handleBackToReview = useCallback(() => {
    cache.updateWorkflowState({ 
      stage: UploadStage.REVIEW, 
      reviewAll: true,
      reviewIndex: 0,
      isEditMode: false,
    });
  }, [cache]);

  // Handle review state changes (position, edit mode)
  const handleReviewStateChange = useCallback((state) => {
    cache.updateWorkflowState({ 
      reviewIndex: state.currentIndex, 
      isEditMode: state.isEditMode,
    });
  }, [cache]);

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
      cache.resetWorkflowState();
    } catch (err) {
      setSaveError(`Failed to save to library: ${err}`);
    } finally {
      setIsSaving(false);
    }
  }, [libraryPath, cache]);

  // Reset everything
  const handleReset = useCallback(() => {
    cache.clearAll();
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
      {stage === UploadStage.PROCESS && (
        <ProcessFile onStartReview={handleStartReview} />
      )}

      {/* Review stage - confirming metadata */}
      {stage === UploadStage.REVIEW && (
        <ReviewScreen
          files={cache.trackedFiles}
          reviewAll={reviewAll}
          initialState={{ currentIndex: reviewIndex, isEditMode }}
          onStateChange={handleReviewStateChange}
          onComplete={handleReviewComplete}
          onExit={handleExitReview}
          onConfirmFile={handleConfirmFile}
          onUnconfirmFile={handleUnconfirmFile}
          onRemoveFile={handleRemoveFile}
          onEditFile={handleEditFile}
          library={library}
        />
      )}

      {/* Complete stage - ready to save */}
      {stage === UploadStage.COMPLETE && (
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
      )}
    </div>
  );
}
