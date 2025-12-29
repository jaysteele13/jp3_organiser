/**
 * useReviewNavigation Hook
 * 
 * Manages navigation through files during review process.
 * Handles confirmation, removal, and edit mode.
 */

import { useState, useCallback, useMemo } from 'react';

export function useReviewNavigation(files, { onConfirm, onRemove, onEdit }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);

  // Get files that haven't been confirmed or removed
  const pendingFiles = useMemo(() => 
    files.filter(f => !f.isConfirmed),
    [files]
  );

  // Current file being reviewed
  const currentFile = useMemo(() => {
    if (pendingFiles.length === 0) return null;
    const safeIndex = Math.min(currentIndex, pendingFiles.length - 1);
    return pendingFiles[safeIndex];
  }, [pendingFiles, currentIndex]);

  // Navigation stats
  const totalPending = pendingFiles.length;
  const currentPosition = totalPending > 0 ? Math.min(currentIndex + 1, totalPending) : 0;

  // Check if we can navigate
  const canGoNext = currentIndex < pendingFiles.length - 1;
  const canGoPrevious = currentIndex > 0;

  // Go to next file
  const goNext = useCallback(() => {
    if (canGoNext) {
      setCurrentIndex(prev => prev + 1);
      setIsEditMode(false);
    }
  }, [canGoNext]);

  // Go to previous file
  const goPrevious = useCallback(() => {
    if (canGoPrevious) {
      setCurrentIndex(prev => prev - 1);
      setIsEditMode(false);
    }
  }, [canGoPrevious]);

  // Confirm current file
  const confirmCurrent = useCallback(() => {
    if (!currentFile) return;
    
    onConfirm(currentFile.trackingId);
    
    // Stay at current index (next file will slide into this position)
    // Adjust if we're at the end
    if (currentIndex >= pendingFiles.length - 1 && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
    setIsEditMode(false);
  }, [currentFile, currentIndex, pendingFiles.length, onConfirm]);

  // Remove current file from list
  const removeCurrent = useCallback(() => {
    if (!currentFile) return;
    
    onRemove(currentFile.trackingId);
    
    // Adjust index if needed
    if (currentIndex >= pendingFiles.length - 1 && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
    setIsEditMode(false);
  }, [currentFile, currentIndex, pendingFiles.length, onRemove]);

  // Enter edit mode
  const enterEditMode = useCallback(() => {
    setIsEditMode(true);
  }, []);

  // Exit edit mode
  const exitEditMode = useCallback(() => {
    setIsEditMode(false);
  }, []);

  // Save edited metadata
  const saveEdit = useCallback((trackingId, metadata) => {
    onEdit(trackingId, metadata);
    setIsEditMode(false);
  }, [onEdit]);

  // Reset navigation
  const reset = useCallback(() => {
    setCurrentIndex(0);
    setIsEditMode(false);
  }, []);

  return {
    // State
    currentIndex,
    isEditMode,
    
    // Computed
    currentFile,
    totalPending,
    currentPosition,
    canGoNext,
    canGoPrevious,
    isComplete: pendingFiles.length === 0,
    
    // Actions
    goNext,
    goPrevious,
    confirmCurrent,
    removeCurrent,
    enterEditMode,
    exitEditMode,
    saveEdit,
    reset,
  };
}
