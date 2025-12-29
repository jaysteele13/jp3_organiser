/**
 * useReviewNavigation Hook
 * 
 * Manages navigation through files during review process.
 * Handles confirmation, removal, and edit mode.
 * 
 * Supports two modes:
 * - Normal mode: Only shows pending (unconfirmed) files
 * - Review All mode: Shows all files, allows un-confirming
 */

import { useState, useCallback, useMemo } from 'react';

export function useReviewNavigation(files, { onConfirm, onUnconfirm, onRemove, onEdit, reviewAll = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);

  // Get files to display based on mode
  const displayFiles = useMemo(() => {
    if (reviewAll) {
      // Show all non-error files in reviewAll mode
      return files.filter(f => f.metadataStatus !== 'error');
    }
    // Normal mode: only show pending (unconfirmed) files
    return files.filter(f => !f.isConfirmed);
  }, [files, reviewAll]);

  // Current file being reviewed
  const currentFile = useMemo(() => {
    if (displayFiles.length === 0) return null;
    const safeIndex = Math.min(currentIndex, displayFiles.length - 1);
    return displayFiles[safeIndex];
  }, [displayFiles, currentIndex]);

  // Navigation stats
  const totalFiles = displayFiles.length;
  const currentPosition = totalFiles > 0 ? Math.min(currentIndex + 1, totalFiles) : 0;

  // Check if we can navigate
  const canGoNext = currentIndex < displayFiles.length - 1;
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
    
    // In reviewAll mode, stay on the same file (just mark it confirmed)
    // In normal mode, adjust index as the file will be removed from pending list
    if (!reviewAll) {
      if (currentIndex >= displayFiles.length - 1 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }
    setIsEditMode(false);
  }, [currentFile, currentIndex, displayFiles.length, onConfirm, reviewAll]);

  // Unconfirm current file (for re-review mode)
  const unconfirmCurrent = useCallback(() => {
    if (!currentFile || !onUnconfirm) return;
    
    onUnconfirm(currentFile.trackingId);
    setIsEditMode(false);
  }, [currentFile, onUnconfirm]);

  // Remove current file from list
  const removeCurrent = useCallback(() => {
    if (!currentFile) return;
    
    onRemove(currentFile.trackingId);
    
    // Adjust index if needed
    if (currentIndex >= displayFiles.length - 1 && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
    setIsEditMode(false);
  }, [currentFile, currentIndex, displayFiles.length, onRemove]);

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

  // Check if all files are confirmed (only relevant in normal mode)
  const isComplete = useMemo(() => {
    if (reviewAll) return false; // Never auto-complete in reviewAll mode
    return displayFiles.length === 0;
  }, [displayFiles.length, reviewAll]);

  return {
    // State
    currentIndex,
    isEditMode,
    
    // Computed
    currentFile,
    totalFiles,
    currentPosition,
    canGoNext,
    canGoPrevious,
    isComplete,
    
    // Actions
    goNext,
    goPrevious,
    confirmCurrent,
    unconfirmCurrent,
    removeCurrent,
    enterEditMode,
    exitEditMode,
    saveEdit,
    reset,
  };
}
