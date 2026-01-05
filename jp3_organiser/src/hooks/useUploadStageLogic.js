/**
 * useUploadStageLogic Hook
 * 
 * Consolidates display state and review navigation logic.
 * Provides UI conditions and review-related utilities.
 * 
 * @param {Object} cache - Upload cache object from useUploadCache
 * @param {Object} workflow - Workflow machine instance from useWorkflowMachine
 * @param {Object} modeSelector - Mode selector state from useUploadModeSelector
 * @returns {Object} Display conditions and review utilities
 */

import { useMemo, useCallback } from 'react';
import { MetadataStatus } from '../services';
import { UploadStage } from './useUploadCache';

export function useUploadStageLogic(cache, workflow, modeSelector) {
  const { trackedFiles, workflowState, updateWorkflowState } = cache;
  const workflowStage = workflowState.stage;

  // Get reviewable files (exclude errors)
  const reviewableFiles = useMemo(() => {
    return trackedFiles.filter(f => f.metadataStatus !== MetadataStatus.ERROR);
  }, [trackedFiles]);

  // Find index of first unconfirmed file
  const findFirstUnconfirmedIndex = useCallback(() => {
    const index = reviewableFiles.findIndex(f => !f.isConfirmed);
    return index >= 0 ? index : 0;
  }, [reviewableFiles]);

  // Start review at first unconfirmed file
  const handleStartReview = useCallback(() => {
    const startIndex = findFirstUnconfirmedIndex();
    updateWorkflowState({ reviewIndex: startIndex });
    workflow.startReview();
  }, [workflow, findFirstUnconfirmedIndex, updateWorkflowState]);

  return useMemo(() => {
    const hasFiles = trackedFiles.length > 0;
    
    // Mode selector should show when:
    // - In PROCESS stage
    // - No files uploaded yet
    // - Mode not yet selected
    // - Not showing context form
    const shouldShowModeSelector = 
      workflowStage === UploadStage.PROCESS &&
      !hasFiles &&
      !modeSelector.modeSelected &&
      !modeSelector.showContextForm;
    
    // Change mode button should show when:
    // - In PROCESS stage
    // - No files uploaded yet
    // - Mode already selected
    // - Not showing context form
    const shouldShowChangeModeButton = 
      workflowStage === UploadStage.PROCESS &&
      !hasFiles &&
      modeSelector.modeSelected &&
      !modeSelector.showContextForm;

    return {
      // Display conditions
      hasFiles,
      shouldShowModeSelector,
      shouldShowChangeModeButton,
      
      // Review navigation
      reviewableFiles,
      findFirstUnconfirmedIndex,
      handleStartReview,
    };
  }, [workflowStage, trackedFiles, modeSelector.modeSelected, modeSelector.showContextForm, reviewableFiles, findFirstUnconfirmedIndex, handleStartReview]);
}
