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
 */

import React, { useCallback, useMemo } from 'react';
import ProcessFile from '../ProcessFile';
import ReviewScreen from '../ReviewScreen';
import UploadModeSelector from '../UploadModeSelector';
import ContextForm from '../ContextForm';
import SaveToLibrary from '../SaveToLibrary';
import { 
  useUploadCache, 
  useWorkflowMachine,
  useUploadModeSelector,
  useToast,
} from '../../../../hooks';
import { Toast } from '../../../../components';
import { MetadataStatus } from '../../../../services';
import styles from './UploadFile.module.css';

export default function UploadFile({libraryPath}) {
  const cache = useUploadCache();
  const toast = useToast(5000);

  // Get workflow state from cache
  const { reviewIndex, isEditMode } = cache.workflowState;

  // State machine for workflow transitions
  const workflow = useWorkflowMachine({
    workflowState: cache.workflowState,
    updateWorkflowState: cache.updateWorkflowState,
    resetWorkflowState: cache.resetWorkflowState,
  });

  // Mode selection logic
  const modeSelector = useUploadModeSelector();

  // Determine if we should show mode selector
  // Show when: in process stage, no files, mode not yet selected, and not showing context form
  const hasFiles = cache.trackedFiles.length > 0;
  const showModeSelector = workflow.isProcessing && !hasFiles && !modeSelector.modeSelected && !modeSelector.showContextForm;
  
  // Show change mode button when: mode selected, no files yet, in process stage
  const showChangeModeButton = workflow.isProcessing && !hasFiles && modeSelector.modeSelected && !modeSelector.showContextForm;

  // Get reviewable files (non-error files, same filter as useReviewNavigation)
  const reviewableFiles = useMemo(() => {
    return cache.trackedFiles.filter(f => f.metadataStatus !== MetadataStatus.ERROR);
  }, [cache.trackedFiles]);

  // Find index of first unconfirmed file, or 0 if all confirmed
  const getFirstUnconfirmedIndex = useCallback(() => {
    const index = reviewableFiles.findIndex(f => !f.isConfirmed);
    return index >= 0 ? index : 0;
  }, [reviewableFiles]);

  // Start review at first unconfirmed file
  const handleStartReview = useCallback(() => {
    const startIndex = getFirstUnconfirmedIndex();
    cache.updateWorkflowState({ reviewIndex: startIndex });
    workflow.startReview();
  }, [workflow, cache, getFirstUnconfirmedIndex]);

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

  // Render based on current stage
  return (
    <div className={styles.wrapper}>
      {/* Toast notification for success messages */}
      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={toast.hideToast}
      />

      {/* Change mode button - outside container, only when mode selected but no files */}
      {showChangeModeButton && (
        <button 
          className={styles.changeModeButton} 
          onClick={modeSelector.handleChangeMode}
        >
          ← Change Upload Mode
        </button>
      )}

      <div className={styles.uploadContainer}>
        {/* Context form modal for Album/Artist modes */}
        {modeSelector.showContextForm && modeSelector.pendingMode && (
          <ContextForm
            mode={modeSelector.pendingMode}
            onSubmit={modeSelector.handleContextSubmit}
            onCancel={modeSelector.handleContextCancel}
          />
        )}

        {/* Mode selector - shown when no files and in process stage */}
        {showModeSelector && (
          <UploadModeSelector
            onSelectSongs={modeSelector.handleSelectSongsMode}
            onSelectAlbum={modeSelector.handleSelectAlbumMode}
            onSelectArtist={modeSelector.handleSelectArtistMode}
          />
        )}

        {/* Process stage - file selection and processing (after mode selected) */}
        {workflow.isProcessing && !showModeSelector && (
          <ProcessFile 
            onStartReview={handleStartReview} 
          />
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
          <SaveToLibrary
            libraryPath={libraryPath}
            confirmedFiles={cache.confirmedFiles}
            workflow={workflow}
            cache={cache}
            toast={toast}
          />
        )}
      </div>
    </div>
  );
}
