/**
 * useReviewNavigation Hook
 * 
 * Manages navigation through files during review process.
 * Handles confirmation, removal, and edit mode.
 * 
 * All files are always visible and navigable. Users can:
 * - Navigate freely between all files (confirmed or not)
 * - Confirm/unconfirm any file at any time
 * - Edit any file at any time
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
  initialState = { currentIndex: 0, isEditMode: false },
  onStateChange,
}) {
  const [currentIndex, setCurrentIndex] = useState(initialState?.currentIndex ?? 0);
  const [isEditMode, setIsEditMode] = useState(initialState?.isEditMode ?? false);
  const [validationError, setValidationError] = useState(null);
  // Track navigation direction for slide animation: 'left', 'right', or null
  const [slideDirection, setSlideDirection] = useState(null);

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

  // Show all non-error files - users can navigate freely between confirmed and unconfirmed
  const displayFiles = useMemo(() => {
    const safeFiles = files || [];
    return safeFiles.filter(f => f.metadataStatus !== 'error');
  }, [files]);

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
  const confirmedCount = useMemo(() => {
    return displayFiles.filter(f => f.isConfirmed).length;
  }, [displayFiles]);
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
      setSlideDirection('left');
      setCurrentIndex(prev => prev + 1);
      setIsEditMode(false);
      clearValidationError();
    }
  }, [canGoNext, clearValidationError]);

  // Go to previous file
  const goPrevious = useCallback(() => {
    if (canGoPrevious) {
      setSlideDirection('right');
      setCurrentIndex(prev => prev - 1);
      setIsEditMode(false);
      clearValidationError();
    }
  }, [canGoPrevious, clearValidationError]);

  // Confirm current file (with validation), then advance to next
  // Returns true if this confirmation completed all files
  const confirmCurrent = useCallback(() => {
    if (!currentFile) return false;
    
    // Validate required fields
    const validation = validateMetadata(currentFile);
    if (!validation.isValid) {
      setValidationError(`Missing required fields: ${validation.missingFields.join(', ')}`);
      return false;
    }
    
    clearValidationError();
    onConfirm(currentFile.trackingId);
    setIsEditMode(false);
    
    // Check if this was the last unconfirmed file
    const unconfirmedCount = displayFiles.filter(f => !f.isConfirmed).length;
    const isLastToConfirm = unconfirmedCount === 1 && !currentFile.isConfirmed;
    
    // Advance to next file if available (and not completing all)
    if (!isLastToConfirm && currentIndex < displayFiles.length - 1) {
      setSlideDirection('left');
      setCurrentIndex(prev => prev + 1);
    }
    
    return isLastToConfirm;
  }, [currentFile, onConfirm, clearValidationError, currentIndex, displayFiles]);

  // Unconfirm current file
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
    
    // Adjust index if we're at the end
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

  // Save edited metadata (does NOT auto-confirm)
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
    setSlideDirection(null);
  }, []);

  // Clear slide direction (called after animation completes)
  const clearSlideDirection = useCallback(() => {
    setSlideDirection(null);
  }, []);

  // Check if all files are confirmed
  const allConfirmed = useMemo(() => {
    return displayFiles.length > 0 && displayFiles.every(f => f.isConfirmed);
  }, [displayFiles]);

  return {
    // State
    currentIndex,
    isEditMode,
    validationError,
    slideDirection,
    
    // Computed
    currentFile,
    currentValidation,
    totalFiles,
    confirmedCount,
    currentPosition,
    canGoNext,
    canGoPrevious,
    allConfirmed,
    
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
    clearSlideDirection,
  };
}
