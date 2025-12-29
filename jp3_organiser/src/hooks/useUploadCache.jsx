/**
 * useUploadCache Hook & Context
 * 
 * Provides persistent storage for processed audio files across navigation.
 * Files remain cached until explicitly cleared or saved to library.
 * 
 * Usage:
 * 1. Wrap app with <UploadCacheProvider>
 * 2. Use useUploadCache() hook to access cached state
 */

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { MetadataStatus } from '../services';

// =============================================================================
// Context
// =============================================================================

const UploadCacheContext = createContext(null);

// =============================================================================
// Provider Component
// =============================================================================

/**
 * Provider component that maintains upload state across navigation.
 * Place this near the top of the component tree (e.g., in App.jsx).
 */
export function UploadCacheProvider({ children }) {
  // Core state that persists across navigation
  const [trackedFiles, setTrackedFiles] = useState([]);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Calculate stats from current files
  const stats = useMemo(() => ({
    total: trackedFiles.length,
    complete: trackedFiles.filter(f => f.metadataStatus === MetadataStatus.COMPLETE).length,
    incomplete: trackedFiles.filter(f => f.metadataStatus === MetadataStatus.INCOMPLETE).length,
    error: trackedFiles.filter(f => f.metadataStatus === MetadataStatus.ERROR).length,
  }), [trackedFiles]);

  // Get incomplete files for review
  const incompleteFiles = useMemo(() => 
    trackedFiles.filter(f => f.metadataStatus === MetadataStatus.INCOMPLETE),
    [trackedFiles]
  );

  // Check if all files are ready (complete or skipped, ignoring errors)
  const allFilesReady = useMemo(() => {
    const nonErrorFiles = trackedFiles.filter(f => f.metadataStatus !== MetadataStatus.ERROR);
    return nonErrorFiles.length > 0 && stats.incomplete === 0;
  }, [trackedFiles, stats.incomplete]);

  // Add a single file to the cache
  const addFile = useCallback((file) => {
    setTrackedFiles(prev => [...prev, file]);
  }, []);

  // Add multiple files to the cache
  const addFiles = useCallback((files) => {
    setTrackedFiles(prev => [...prev, ...files]);
  }, []);

  // Replace all files (used when starting a new batch)
  const setFiles = useCallback((files) => {
    setTrackedFiles(files);
  }, []);

  // Clear all files and messages
  const clearAll = useCallback(() => {
    setTrackedFiles([]);
    setError(null);
    setSuccessMessage(null);
  }, []);

  // Update metadata for a file and mark as complete
  const updateFileMetadata = useCallback((trackingId, metadata) => {
    setTrackedFiles(prev => prev.map(file => {
      if (file.trackingId === trackingId) {
        return {
          ...file,
          metadata: { ...file.metadata, ...metadata },
          metadataStatus: MetadataStatus.COMPLETE,
        };
      }
      return file;
    }));
  }, []);

  // Remove a file from the list
  const removeFile = useCallback((trackingId) => {
    setTrackedFiles(prev => prev.filter(f => f.trackingId !== trackingId));
  }, []);

  // Remove all complete files (after saving to library)
  const removeCompleteFiles = useCallback(() => {
    setTrackedFiles(prev => 
      prev.filter(f => f.metadataStatus !== MetadataStatus.COMPLETE)
    );
  }, []);

  const value = useMemo(() => ({
    // State
    trackedFiles,
    error,
    successMessage,
    
    // Computed
    stats,
    incompleteFiles,
    allFilesReady,
    
    // Actions
    addFile,
    addFiles,
    setFiles,
    clearAll,
    updateFileMetadata,
    removeFile,
    removeCompleteFiles,
    setError,
    setSuccessMessage,
    clearError: () => setError(null),
    clearSuccess: () => setSuccessMessage(null),
  }), [
    trackedFiles,
    error,
    successMessage,
    stats,
    incompleteFiles,
    allFilesReady,
    addFile,
    addFiles,
    setFiles,
    clearAll,
    updateFileMetadata,
    removeFile,
    removeCompleteFiles,
  ]);

  return (
    <UploadCacheContext.Provider value={value}>
      {children}
    </UploadCacheContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access the upload cache context.
 * Must be used within an UploadCacheProvider.
 * 
 * @returns {Object} Upload cache state and actions
 */
export function useUploadCache() {
  const context = useContext(UploadCacheContext);
  
  if (!context) {
    throw new Error('useUploadCache must be used within an UploadCacheProvider');
  }
  
  return context;
}
