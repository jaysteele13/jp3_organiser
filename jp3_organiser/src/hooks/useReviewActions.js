/**
 * useReviewActions Hook
 * 
 * Provides handlers for review screen actions.
 * All operations are proxied to cache with memoization.
 * 
 * @param {Object} cache - Upload cache instance
 * @returns {Object} Review action handlers
 */

import { useCallback } from 'react';

export function useReviewActions(cache) {
  const handleConfirmFile = useCallback((trackingId) => {
    cache.confirmFile(trackingId);
  }, [cache]);

  const handleUnconfirmFile = useCallback((trackingId) => {
    cache.unconfirmFile(trackingId);
  }, [cache]);

  const handleRemoveFile = useCallback((trackingId) => {
    cache.removeFile(trackingId);
  }, [cache]);

  const handleEditFile = useCallback((trackingId, metadata) => {
    cache.updateFileMetadata(trackingId, metadata);
  }, [cache]);

  const handleReviewStateChange = useCallback((state) => {
    cache.updateWorkflowState({ 
      reviewIndex: state.currentIndex, 
      isEditMode: state.isEditMode,
    });
  }, [cache]);

  return {
    handleConfirmFile,
    handleUnconfirmFile,
    handleRemoveFile,
    handleEditFile,
    handleReviewStateChange,
  };
}
