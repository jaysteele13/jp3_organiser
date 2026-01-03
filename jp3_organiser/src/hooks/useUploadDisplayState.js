/**
 * useUploadDisplayState Hook
 * 
 * Determines what UI elements should be displayed based on current workflow state.
 * 
 * Instead of multiple boolean flags scattered throughout the component,
 * this hook provides clear, named conditions for conditional rendering.
 * 
 * @param {Object} workflow - Workflow machine instance
 * @param {Object} cache - Upload cache instance
 * @param {Object} modeSelector - Mode selector state from useUploadModeSelector
 * @returns {Object} Display state conditions
 */

import { useMemo } from 'react';
import { UploadStage } from './useUploadCache';

// Is doing these bools best oractice (however this is very clear)
export function useUploadDisplayState(workflow, cache, modeSelector) {
  const trackedFiles = cache.trackedFiles;
  const workflowStage = cache.workflowState.stage;

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
      hasFiles,
      shouldShowModeSelector,
      shouldShowChangeModeButton,
    };
  }, [workflowStage, trackedFiles, modeSelector]);
}
