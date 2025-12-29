/**
 * useReviewNavigation Hook
 * 
 * Manages navigation through files during review process.
 * Handles confirmation, removal, and edit mode.
 * 
 * Supports two modes:
 * - Normal mode: Only shows pending (unconfirmed) files
 * - Review All mode: Shows all files, allows un-confirming
 * 
 * Includes validation to ensure required fields are present before confirming.
 * Supports persisting state via initialState and onStateChange.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

/**
 * Validate that a file has all required metadata fields.
 * @param {Object} file - The file to validate
 * @returns {Object} { isValid: boolean, missingFields: string[] }
 */
function validateMetadata(file) {
  const missingFields = [];
  const metadata = file?.metadata;

  if (!metadata?.title?.trim()) {
    missingFields.push('Title');
  }
  if (!metadata?.artist?.trim()) {
    missingFields.push('Artist');
  }
  if (!metadata?.album?.trim()) {
    missingFields.push('Album');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
  };
}

export function useReviewNavigation(files, { 
  onConfirm, 
  onUnconfirm, 
  onRemove, 
  onEdit, 
  reviewAll = false,
  initialState = { currentIndex: 0, isEditMode: false },
  onStateChange,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialState?.currentIndex ?? 0);
  const [isEditMode, setIsEditMode] = useState(initialState?.isEditMode ?? false);
  const [validationError, setValidationError] = useState(null);

  // Use ref for callback to avoid effect re-runs
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  
  // Track if we've initialized to avoid triggering onStateChange on mount
  const isInitialized = useRef(false);

  // Notify parent of state changes (for persistence)
  useEffect(() => {
    if (isInitialized.current && onStateChangeRef.current) {
      onStateChangeRef.current({ currentIndex, isEditMode });
    }
    isInitialized.current = true;
  }, [currentIndex, isEditMode]);

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

  // Validate current file
  const currentValidation = useMemo(() => {
    if (!currentFile) return { isValid: true, missingFields: [] };
    return validateMetadata(currentFile);
  }, [currentFile]);

  // Navigation stats
  const totalFiles = displayFiles.length;
  const currentPosition = totalFiles > 0 ? Math.min(currentIndex + 1, totalFiles) : 0;

  // Check if we can navigate
  const canGoNext = currentIndex < displayFiles.length - 1;
  const canGoPrevious = currentIndex > 0;

  // Clear validation error when navigating
  const clearValidationError = useCallback(() => {
    setValidationError(null);
  }, []);

  // Go to next file
  const goNext = useCallback(() => {
    if (canGoNext) {
      setCurrentIndex(prev => prev + 1);
      setIsEditMode(false);
      clearValidationError();
    }
  }, [canGoNext, clearValidationError]);

  // Go to previous file
  const goPrevious = useCallback(() => {
    if (canGoPrevious) {
      setCurrentIndex(prev => prev - 1);
      setIsEditMode(false);
      clearValidationError();
    }
  }, [canGoPrevious, clearValidationError]);

  // Confirm current file (with validation)
  const confirmCurrent = useCallback(() => {
    if (!currentFile) return;
    
    // Validate required fields
    const validation = validateMetadata(currentFile);
    if (!validation.isValid) {
      setValidationError(`Missing required fields: ${validation.missingFields.join(', ')}`);
      return;
    }
    
    clearValidationError();
    onConfirm(currentFile.trackingId);
    
    // In reviewAll mode, stay on the same file (just mark it confirmed)
    // In normal mode, adjust index as the file will be removed from pending list
    if (!reviewAll) {
      if (currentIndex >= displayFiles.length - 1 && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    }
    setIsEditMode(false);
  }, [currentFile, currentIndex, displayFiles.length, onConfirm, reviewAll, clearValidationError]);

  // Unconfirm current file (for re-review mode)
  const unconfirmCurrent = useCallback(() => {
    if (!currentFile || !onUnconfirm) return;
    
    clearValidationError();
    onUnconfirm(currentFile.trackingId);
    setIsEditMode(false);
  }, [currentFile, onUnconfirm, clearValidationError]);

  // Remove current file from list
  const removeCurrent = useCallback(() => {
    if (!currentFile) return;
    
    clearValidationError();
    onRemove(currentFile.trackingId);
    
    // Adjust index if needed
    if (currentIndex >= displayFiles.length - 1 && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
    setIsEditMode(false);
  }, [currentFile, currentIndex, displayFiles.length, onRemove, clearValidationError]);

  // Enter edit mode
  const enterEditMode = useCallback(() => {
    clearValidationError();
    setIsEditMode(true);
  }, [clearValidationError]);

  // Exit edit mode
  const exitEditMode = useCallback(() => {
    setIsEditMode(false);
  }, []);

  // Save edited metadata
  const saveEdit = useCallback((trackingId, metadata) => {
    clearValidationError();
    onEdit(trackingId, metadata);
    setIsEditMode(false);
  }, [onEdit, clearValidationError]);

  // Reset navigation
  const reset = useCallback(() => {
    setCurrentIndex(0);
    setIsEditMode(false);
    setValidationError(null);
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
    validationError,
    
    // Computed
    currentFile,
    currentValidation,
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
    clearValidationError,
  };
}
