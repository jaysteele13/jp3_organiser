/**
 * UploadFile Component
 * 
 * Orchestrates the complete audio file upload workflow using a state machine:
 * 1. PROCESS: User selects mode, optionally enters context, then selects files
 * 2. REVIEW: User reviews and confirms metadata for each file
 * 3. READY_TO_SAVE: All files confirmed, user can save to library
 * 
 * Upload modes:
 * - Add Songs: Auto-detect everything via AcousticID
 * - Add Album: User specifies album + artist upfront
 * - Add Artist: User specifies artist upfront
 * 
 * Workflow state is persisted in cache so navigation doesn't lose progress.
 * Uses useWorkflowMachine for explicit, predictable state transitions.
 * 
 * @param {Object} props
 * @param {string} props.libraryPath - The configured library directory path
 */

import React, { useState, useCallback, useMemo } from 'react';
import ProcessFile from '../ProcessFile';
import ReviewScreen from '../ReviewScreen';
import UploadModeSelector from '../UploadModeSelector';
import ContextForm from '../ContextForm';
import { 
  useUploadCache, 
  useWorkflowMachine,
} from '../../../../hooks';
import { saveToLibrary, MetadataStatus } from '../../../../services';
import { UPLOAD_MODE } from '../../../../utils';
import styles from './UploadFile.module.css';

export default function UploadFile({ libraryPath }) {
  const cache = useUploadCache();
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [showContextForm, setShowContextForm] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);

  // Get workflow state from cache
  const { reviewIndex, isEditMode } = cache.workflowState;

  // State machine for workflow transitions
  const workflow = useWorkflowMachine({
    workflowState: cache.workflowState,
    updateWorkflowState: cache.updateWorkflowState,
    resetWorkflowState: cache.resetWorkflowState,
  });

  // Determine if we should show mode selector (no files loaded and in process stage)
  const hasFiles = cache.trackedFiles.length > 0;
  const showModeSelector = workflow.isProcessing && !hasFiles && !showContextForm;

  // Get reviewable files (non-error files, same filter as useReviewNavigation)
  const reviewableFiles = useMemo(() => {
    return cache.trackedFiles.filter(f => f.metadataStatus !== MetadataStatus.ERROR);
  }, [cache.trackedFiles]);

  // Find index of first unconfirmed file, or 0 if all confirmed
  const getFirstUnconfirmedIndex = useCallback(() => {
    const index = reviewableFiles.findIndex(f => !f.isConfirmed);
    return index >= 0 ? index : 0;
  }, [reviewableFiles]);

  // === Mode Selection Handlers ===

  // Handle "Add Songs" mode - proceed directly to file selection
  const handleSelectSongsMode = useCallback(() => {
    cache.setUploadMode(UPLOAD_MODE.SONGS);
    cache.setUploadContext({ album: null, artist: null, year: null });
    // ProcessFile will handle file selection
  }, [cache]);

  // Handle "Add Album" mode - show context form
  const handleSelectAlbumMode = useCallback(() => {
    setPendingMode(UPLOAD_MODE.ALBUM);
    setShowContextForm(true);
  }, []);

  // Handle "Add Artist" mode - show context form
  const handleSelectArtistMode = useCallback(() => {
    setPendingMode(UPLOAD_MODE.ARTIST);
    setShowContextForm(true);
  }, []);

  // Handle context form submission
  const handleContextSubmit = useCallback((context) => {
    cache.setUploadMode(pendingMode);
    cache.setUploadContext(context);
    setShowContextForm(false);
    setPendingMode(null);
    // ProcessFile will handle file selection
  }, [cache, pendingMode]);

  // Handle context form cancel
  const handleContextCancel = useCallback(() => {
    setShowContextForm(false);
    setPendingMode(null);
  }, []);

  // Start review at first unconfirmed file
  const handleStartReview = useCallback(() => {
    const startIndex = getFirstUnconfirmedIndex();
    cache.updateWorkflowState({ reviewIndex: startIndex });
    workflow.startReview();
  }, [workflow, cache, getFirstUnconfirmedIndex]);

  // Back to review at first unconfirmed file
  const handleBackToReview = useCallback(() => {
    const startIndex = getFirstUnconfirmedIndex();
    workflow.backToReview(startIndex);
  }, [workflow, getFirstUnconfirmedIndex]);

  // Handle file confirmation in ReviewScreen
  const handleConfirmFile = useCallback((trackingId) => {
    cache.confirmFile(trackingId);
  }, [cache]);

  // Handle file unconfirmation in ReviewScreen
  const handleUnconfirmFile = useCallback((trackingId) => {
    cache.unconfirmFile(trackingId);
  }, [cache]);

  // Handle file removal in ReviewScreen
  const handleRemoveFile = useCallback((trackingId) => {
    cache.removeFile(trackingId);
  }, [cache]);

  // Handle file edit in ReviewScreen (does not auto-confirm)
  const handleEditFile = useCallback((trackingId, metadata) => {
    cache.updateFileMetadata(trackingId, metadata);
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

      // Clear saved files from cache and reset workflow
      cache.removeConfirmedFiles();
      workflow.saveComplete();
    } catch (err) {
      setSaveError(`Failed to save to library: ${err}`);
    } finally {
      setIsSaving(false);
    }
  }, [libraryPath, cache, workflow]);

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

      {/* Context form modal for Album/Artist modes */}
      {showContextForm && pendingMode && (
        <ContextForm
          mode={pendingMode}
          onSubmit={handleContextSubmit}
          onCancel={handleContextCancel}
        />
      )}

      {/* Mode selector - shown when no files and in process stage */}
      {showModeSelector && (
        <UploadModeSelector
          onSelectSongs={handleSelectSongsMode}
          onSelectAlbum={handleSelectAlbumMode}
          onSelectArtist={handleSelectArtistMode}
        />
      )}

      {/* Process stage - file selection and processing (after mode selected) */}
      {workflow.isProcessing && !showModeSelector && (
        <ProcessFile onStartReview={handleStartReview} />
      )}

      {/* Review stage - confirming metadata */}
      {workflow.isReviewing && (
        <ReviewScreen
          files={cache.trackedFiles}
          initialState={{ currentIndex: reviewIndex, isEditMode }}
          onStateChange={handleReviewStateChange}
          onDone={workflow.completeReview}
          onExit={workflow.exitReview}
          onConfirmFile={handleConfirmFile}
          onUnconfirmFile={handleUnconfirmFile}
          onRemoveFile={handleRemoveFile}
          onEditFile={handleEditFile}
        />
      )}

      {/* Ready to save stage */}
      {workflow.isReadyToSave && (
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
