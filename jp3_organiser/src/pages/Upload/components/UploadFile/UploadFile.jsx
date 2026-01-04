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
  useWorkflowMachine,
  useUploadModeSelector,
  useUploadStageLogic,
  useToast,
  useUploadCacheSelector,
} from '../../../../hooks';
import { Toast } from '../../../../components';
import styles from './UploadFile.module.css';

export default function UploadFile({libraryPath}) {
  const toast = useToast(8000);

  const modeSelector = useUploadModeSelector();
  const confirmedFiles = useUploadCacheSelector(state => state.confirmedFiles);
  const trackedFiles = useUploadCacheSelector(state => state.trackedFiles);
  const workflowState = useUploadCacheSelector(state => state.workflowState);

  const cacheUpdateWorkflowState = useUploadCacheSelector(state => state.updateWorkflowState);
  const cacheResetWorkflowState = useUploadCacheSelector(state => state.resetWorkflowState);
  const cacheConfirmFile = useUploadCacheSelector(state => state.confirmFile);
  const cacheUnconfirmFile = useUploadCacheSelector(state => state.unconfirmFile);
  const cacheRemoveFile = useUploadCacheSelector(state => state.removeFile);
  const cacheUpdateFileMetadata = useUploadCacheSelector(state => state.updateFileMetadata);

  const workflow = useWorkflowMachine({
    workflowState,
    updateWorkflowState: cacheUpdateWorkflowState,
    resetWorkflowState: cacheResetWorkflowState,
  });

  const stageLogic = useUploadStageLogic(
    trackedFiles,
    workflowState,
    workflow,
    modeSelector,
    cacheUpdateWorkflowState
  );
  const { reviewIndex, isEditMode } = workflowState; // Ensure this is cahced variable

  return (
    <div className={styles.wrapper}>
      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={toast.hideToast}
      />

      {stageLogic.shouldShowChangeModeButton && (
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

        {stageLogic.shouldShowModeSelector && (
          <UploadModeSelector
            onSelectSongs={modeSelector.handleSelectSongsMode}
            onSelectAlbum={modeSelector.handleSelectAlbumMode}
            onSelectArtist={modeSelector.handleSelectArtistMode}
          />
        )}

        {workflow.isProcessing && !stageLogic.shouldShowModeSelector && (
          <ProcessFile 
            onStartReview={stageLogic.handleStartReview} 
          />
        )}

        {workflow.isReviewing && (
          <ReviewScreen
            files={trackedFiles}
            initialState={{ currentIndex: reviewIndex, isEditMode: isEditMode }}
            onStateChange={(state) => cacheUpdateWorkflowState({
              reviewIndex: state.currentIndex, 
              isEditMode: state.isEditMode,
            })}
            onDone={workflow.completeReview}
            onExit={workflow.exitReview}
            onConfirmFile={(trackingId) => cacheConfirmFile(trackingId)}
            onUnconfirmFile={(trackingId) => cacheUnconfirmFile(trackingId)}
            onRemoveFile={(trackingId) => cacheRemoveFile(trackingId)}
            onEditFile={(trackingId, metadata) => cacheUpdateFileMetadata(trackingId, metadata)}
          />
        )}

        {workflow.isReadyToSave && (
          <SaveToLibrary
            libraryPath={libraryPath}
            confirmedFiles={confirmedFiles}
            workflow={workflow}
            toast={toast}
          />
        )}
      </div>
    </div>
  );
}
