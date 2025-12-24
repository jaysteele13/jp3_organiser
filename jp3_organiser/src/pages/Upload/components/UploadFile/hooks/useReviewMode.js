/**
 * useReviewMode Hook
 * 
 * Manages the review mode workflow for stepping through incomplete files.
 * Handles navigation between files and single-file editing.
 */

import { useState, useCallback, useMemo } from 'react';

export function useReviewMode(incompleteFiles, { onSaveMetadata, onRemoveFile }) {
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [editingFileId, setEditingFileId] = useState(null);

  // Current file being reviewed
  const currentReviewFile = useMemo(() => {
    if (!isReviewMode || incompleteFiles.length === 0) return null;
    return incompleteFiles[Math.min(currentIndex, incompleteFiles.length - 1)];
  }, [isReviewMode, incompleteFiles, currentIndex]);

  // File being edited (single edit mode)
  const editingFile = useMemo(() => {
    if (!editingFileId) return null;
    return incompleteFiles.find(f => f.trackingId === editingFileId) || null;
  }, [editingFileId, incompleteFiles]);

  // Start review mode
  const startReview = useCallback(() => {
    setIsReviewMode(true);
    setCurrentIndex(0);
    setEditingFileId(null);
  }, []);

  // Exit review mode
  const exitReview = useCallback(() => {
    setIsReviewMode(false);
    setCurrentIndex(0);
  }, []);

  // Edit a specific file (exits review mode)
  const editFile = useCallback((trackingId) => {
    setEditingFileId(trackingId);
    setIsReviewMode(false);
  }, []);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingFileId(null);
  }, []);

  // Reset all state (call when files are cleared)
  const reset = useCallback(() => {
    setIsReviewMode(false);
    setCurrentIndex(0);
    setEditingFileId(null);
  }, []);

  // Handle save - advances to next file in review mode
  const handleSave = useCallback((trackingId, metadata) => {
    onSaveMetadata(trackingId, metadata);

    if (isReviewMode) {
      // Check if there will be remaining incomplete files after this save
      const remainingCount = incompleteFiles.length - 1;
      if (remainingCount <= 0) {
        setIsReviewMode(false);
      } else {
        // Adjust index if needed
        setCurrentIndex(prev => Math.min(prev, remainingCount - 1));
      }
    } else {
      setEditingFileId(null);
    }
  }, [isReviewMode, incompleteFiles.length, onSaveMetadata]);

  // Handle skip - removes file and advances in review mode
  const handleSkip = useCallback((trackingId) => {
    onRemoveFile(trackingId);

    if (isReviewMode) {
      const remainingCount = incompleteFiles.length - 1;
      if (remainingCount <= 0) {
        setIsReviewMode(false);
      } else {
        setCurrentIndex(prev => Math.min(prev, remainingCount - 1));
      }
    } else {
      setEditingFileId(null);
    }
  }, [isReviewMode, incompleteFiles.length, onRemoveFile]);

  return {
    // State
    isReviewMode,
    currentIndex,
    editingFileId,
    
    // Computed
    currentReviewFile,
    editingFile,
    totalIncomplete: incompleteFiles.length,
    
    // Actions
    startReview,
    exitReview,
    editFile,
    cancelEdit,
    reset,
    handleSave,
    handleSkip,
  };
}
