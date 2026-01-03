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

import React from 'react';
import ProcessFile from '../ProcessFile';
import ReviewScreen from '../ReviewScreen';
import UploadModeSelector from '../UploadModeSelector';
import ContextForm from '../ContextForm';
import SaveToLibrary from '../SaveToLibrary';
import { 
  useUploadCache, 
  useWorkflowMachine,
  useUploadModeSelector,
  useUploadDisplayState,
  useReviewNavigation,
  useReviewActions,
  useToast,
} from '../../../../hooks';
import { Toast } from '../../../../components';
import styles from './UploadFile.module.css';

export default function UploadFile({libraryPath}) {
  const cache = useUploadCache();
  const toast = useToast(5000);

  const { reviewIndex, isEditMode } = cache.workflowState;

  const workflow = useWorkflowMachine({
    workflowState: cache.workflowState,
    updateWorkflowState: cache.updateWorkflowState,
    resetWorkflowState: cache.resetWorkflowState,
  });

  const modeSelector = useUploadModeSelector();
  const displayState = useUploadDisplayState(workflow, cache, modeSelector);
  const reviewNav = useReviewNavigation(cache, workflow);
  const reviewActions = useReviewActions(cache);

  return (
    <div className={styles.wrapper}>
      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={toast.hideToast}
      />

      {displayState.shouldShowChangeModeButton && (
        <button 
          className={styles.changeModeButton} 
          onClick={modeSelector.handleChangeMode}
        >
          ← Change Upload Mode
        </button>
      )}

      <div className={styles.uploadContainer}>
        {modeSelector.showContextForm && modeSelector.pendingMode && (
          <ContextForm
            mode={modeSelector.pendingMode}
            onSubmit={modeSelector.handleContextSubmit}
            onCancel={modeSelector.handleContextCancel}
          />
        )}

        {displayState.shouldShowModeSelector && (
          <UploadModeSelector
            onSelectSongs={modeSelector.handleSelectSongsMode}
            onSelectAlbum={modeSelector.handleSelectAlbumMode}
            onSelectArtist={modeSelector.handleSelectArtistMode}
          />
        )}

        {workflow.isProcessing && !displayState.shouldShowModeSelector && (
          <ProcessFile 
            onStartReview={reviewNav.handleStartReview} 
          />
        )}

        {workflow.isReviewing && (
          <ReviewScreen
            files={cache.trackedFiles}
            initialState={{ currentIndex: reviewIndex, isEditMode }}
            onStateChange={reviewActions.handleReviewStateChange}
            onDone={workflow.completeReview}
            onExit={workflow.exitReview}
            onConfirmFile={reviewActions.handleConfirmFile}
            onUnconfirmFile={reviewActions.handleUnconfirmFile}
            onRemoveFile={reviewActions.handleRemoveFile}
            onEditFile={reviewActions.handleEditFile}
          />
        )}

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
