/**
 * useReviewNavigation Hook
 * 
 * Handles review-specific navigation logic.
 * Finds the correct starting position for review
 * and provides the handler to start review.
 * 
 * @param {Object} cache - Upload cache instance
 * @param {Object} workflow - Workflow machine instance
 * @returns {Object} Review navigation utilities
 */

import { useCallback, useMemo } from 'react';
import { MetadataStatus } from '../services';

export function useReviewNavigation(cache, workflow) {
  // Get reviewable files (exclude errors)
  const reviewableFiles = useMemo(() => {
    return cache.trackedFiles.filter(f => f.metadataStatus !== MetadataStatus.ERROR);
  }, [cache.trackedFiles]);

  // Find index of first unconfirmed file, or 0 if all confirmed
  const findFirstUnconfirmedIndex = useCallback(() => {
    const index = reviewableFiles.findIndex(f => !f.isConfirmed);
    return index >= 0 ? index : 0;
  }, [reviewableFiles]);

  // Start review at first unconfirmed file
  const handleStartReview = useCallback(() => {
    const startIndex = findFirstUnconfirmedIndex();
    cache.updateWorkflowState({ reviewIndex: startIndex });
    workflow.startReview();
  }, [cache, workflow, findFirstUnconfirmedIndex]);

  return {
    reviewableFiles,
    findFirstUnconfirmedIndex,
    handleStartReview,
  };
}
