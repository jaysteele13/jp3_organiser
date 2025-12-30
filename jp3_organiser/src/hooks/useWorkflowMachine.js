/**
 * useWorkflowMachine Hook
 * 
 * State machine for the upload workflow with explicit transitions.
 * Makes state changes predictable and self-documenting.
 * 
 * States (from UploadStage):
 * - PROCESS: File selection and processing
 * - REVIEW: Reviewing and confirming metadata
 * - READY_TO_SAVE: All files confirmed, ready to save to library
 * 
 * Transitions:
 * - PROCESS -> REVIEW: User starts review
 * - REVIEW -> PROCESS: User exits review (with unconfirmed files)
 * - REVIEW -> READY_TO_SAVE: User completes review (all confirmed)
 * - READY_TO_SAVE -> REVIEW: User goes back to review
 * - READY_TO_SAVE -> PROCESS: User saves or resets
 */

import { useCallback, useMemo } from 'react';
import { UploadStage } from './useUploadCache.jsx';

/**
 * Workflow actions (explicit transitions)
 */
export const WorkflowAction = {
  START_REVIEW: 'START_REVIEW',
  EXIT_REVIEW: 'EXIT_REVIEW',
  COMPLETE_REVIEW: 'COMPLETE_REVIEW',
  BACK_TO_REVIEW: 'BACK_TO_REVIEW',
  SAVE_COMPLETE: 'SAVE_COMPLETE',
  RESET: 'RESET',
};

/**
 * State machine transition table.
 * Format: { [currentState]: { [action]: nextState } }
 */
const transitions = {
  [UploadStage.PROCESS]: {
    [WorkflowAction.START_REVIEW]: UploadStage.REVIEW,
  },
  [UploadStage.REVIEW]: {
    [WorkflowAction.EXIT_REVIEW]: UploadStage.PROCESS,
    [WorkflowAction.COMPLETE_REVIEW]: UploadStage.READY_TO_SAVE,
  },
  [UploadStage.READY_TO_SAVE]: {
    [WorkflowAction.BACK_TO_REVIEW]: UploadStage.REVIEW,
    [WorkflowAction.SAVE_COMPLETE]: UploadStage.PROCESS,
    [WorkflowAction.RESET]: UploadStage.PROCESS,
  },
};

/**
 * Hook to manage workflow state machine.
 * 
 * @param {Object} options
 * @param {Object} options.workflowState - Current workflow state from cache
 * @param {function} options.updateWorkflowState - Function to update workflow state
 * @param {function} options.resetWorkflowState - Function to reset workflow state
 * @returns {Object} State machine interface
 */
export function useWorkflowMachine({ workflowState, updateWorkflowState, resetWorkflowState }) {
  const currentStage = workflowState.stage;

  /**
   * Dispatch an action to transition the state machine.
   * Invalid transitions are logged and ignored.
   */
  const dispatch = useCallback((action, payload = {}) => {
    console.log('[WorkflowMachine] dispatch called - action:', action, 'currentStage:', currentStage);
    
    const currentTransitions = transitions[currentStage];
    
    if (!currentTransitions || !currentTransitions[action]) {
      console.warn(
        `[WorkflowMachine] Invalid transition: ${action} from ${currentStage}. ` +
        `Valid actions: ${Object.keys(currentTransitions || {}).join(', ') || 'none'}`
      );
      return false;
    }

    const nextStage = currentTransitions[action];
    
    // Build the state update based on action
    const stateUpdate = { stage: nextStage };
    
    // Reset review position when entering review
    if (action === WorkflowAction.START_REVIEW || action === WorkflowAction.BACK_TO_REVIEW) {
      stateUpdate.reviewIndex = payload.reviewIndex ?? 0;
      stateUpdate.isEditMode = false;
    }
    
    // Reset everything on save complete or reset
    if (action === WorkflowAction.SAVE_COMPLETE || action === WorkflowAction.RESET) {
      resetWorkflowState();
      return true;
    }

    updateWorkflowState(stateUpdate);
    return true;
  }, [currentStage, updateWorkflowState, resetWorkflowState]);

  /**
   * Check if an action is valid from the current state.
   */
  const canDispatch = useCallback((action) => {
    const currentTransitions = transitions[currentStage];
    return !!(currentTransitions && currentTransitions[action]);
  }, [currentStage]);

  /**
   * Convenience methods for common transitions.
   */
  const actions = useMemo(() => ({
    startReview: () => dispatch(WorkflowAction.START_REVIEW),
    exitReview: () => dispatch(WorkflowAction.EXIT_REVIEW),
    completeReview: () => dispatch(WorkflowAction.COMPLETE_REVIEW),
    backToReview: (reviewIndex = 0) => dispatch(WorkflowAction.BACK_TO_REVIEW, { reviewIndex }),
    saveComplete: () => dispatch(WorkflowAction.SAVE_COMPLETE),
    reset: () => dispatch(WorkflowAction.RESET),
  }), [dispatch]);

  /**
   * Check which actions are currently available.
   */
  const availableActions = useMemo(() => ({
    canStartReview: canDispatch(WorkflowAction.START_REVIEW),
    canExitReview: canDispatch(WorkflowAction.EXIT_REVIEW),
    canCompleteReview: canDispatch(WorkflowAction.COMPLETE_REVIEW),
    canBackToReview: canDispatch(WorkflowAction.BACK_TO_REVIEW),
    canSaveComplete: canDispatch(WorkflowAction.SAVE_COMPLETE),
    canReset: canDispatch(WorkflowAction.RESET),
  }), [canDispatch]);

  return {
    // Current state
    stage: currentStage,
    
    // State checks
    isProcessing: currentStage === UploadStage.PROCESS,
    isReviewing: currentStage === UploadStage.REVIEW,
    isReadyToSave: currentStage === UploadStage.READY_TO_SAVE,
    
    // Actions
    ...actions,
    dispatch,
    
    // Action availability
    ...availableActions,
    canDispatch,
  };
}
