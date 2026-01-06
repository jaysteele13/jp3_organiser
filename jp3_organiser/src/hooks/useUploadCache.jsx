/**
 * useUploadCache Hook & Context
 * 
 * Provides persistent storage for processed audio files across navigation.
 * Files remain cached until explicitly cleared or saved to library.
 * 
 * Note: Only trackedFiles and error are persisted. Success messages are
 * transient and should be managed locally in the consuming component.
 * 
 * Usage:
 * 1. Wrap app with <UploadCacheProvider>
 * 2. Use useUploadCache() hook to access cached state
 */

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { MetadataStatus } from '../services';
import { UPLOAD_MODE } from '../utils';

/**
 * Metadata source types for tracking how metadata was obtained.
 */
export const MetadataSource = {
  /** Metadata source not yet determined */
  UNKNOWN: 'unknown',
  /** Metadata from ID3 tags embedded in the file */
  ID3: 'id3',
  /** Metadata from audio fingerprint matching (Chromaprint -> AcoustID -> MusicBrainz) */
  FINGERPRINT: 'fingerprint',
  /** Metadata entered manually by user */
  MANUAL: 'manual',
};

/**
 * Workflow stages for the upload process.
 */
export const UploadStage = {
  PROCESS: 'process',        // File selection and processing
  REVIEW: 'review',          // Reviewing and confirming metadata
  READY_TO_SAVE: 'ready_to_save', // All files confirmed, ready to save
};

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
 * 
 * Persisted state:
 * - trackedFiles: The processed audio files
 * - error: Any error message (persisted so user sees it when returning)
 * - workflowState: Current stage and review mode
 * 
 * NOT persisted (should be local state):
 * - successMessage: Transient feedback after saving to library
 * - isProcessing, isSaving: Loading states
 */
export function UploadCacheProvider({ children }) {
  // Core state that persists across navigation
  const [trackedFiles, setTrackedFiles] = useState([]);
  const [error, setError] = useState(null);
  
  // Upload mode and context (album/artist/playlist pre-set by user)
  const [uploadMode, setUploadMode] = useState(UPLOAD_MODE.SONGS);
  const [uploadContext, setUploadContext] = useState({
    album: null,
    artist: null,
    year: null,
    playlist: null,
    playlistId: null, // null = create new playlist, number = existing playlist
  });
  // Whether user has selected a mode (persists across navigation)
  const [modeSelected, setModeSelected] = useState(false);
  
  // Workflow state that persists across navigation
  const [workflowState, setWorkflowState] = useState({
    stage: UploadStage.PROCESS,
    reviewIndex: 0,
    isEditMode: false,
  });

  // Calculate stats from current files
  const stats = useMemo(() => {
    const confirmed = trackedFiles.filter(f => f.isConfirmed).length;
    const automated = trackedFiles.filter(
      f => f.metadataStatus === MetadataStatus.COMPLETE && !f.isConfirmed
    ).length;
    const incomplete = trackedFiles.filter(f => f.metadataStatus === MetadataStatus.INCOMPLETE).length;
    const error = trackedFiles.filter(f => f.metadataStatus === MetadataStatus.ERROR).length;
    
    return {
      total: trackedFiles.length,
      confirmed,
      automated,
      incomplete,
      error,
      // Legacy: keep 'complete' for backward compatibility (all files with complete metadata)
      complete: trackedFiles.filter(f => f.metadataStatus === MetadataStatus.COMPLETE).length,
      pending: trackedFiles.filter(f => !f.isConfirmed && f.metadataStatus !== MetadataStatus.ERROR).length,
    };
  }, [trackedFiles]);

  // Get incomplete files for review
  const incompleteFiles = useMemo(() => 
    trackedFiles.filter(f => f.metadataStatus === MetadataStatus.INCOMPLETE),
    [trackedFiles]
  );

  // Get files pending confirmation (not yet confirmed by user)
  const pendingConfirmation = useMemo(() =>
    trackedFiles.filter(f => !f.isConfirmed && f.metadataStatus !== MetadataStatus.ERROR),
    [trackedFiles]
  );

  // Get confirmed files (ready to add to library)
  const confirmedFiles = useMemo(() =>
    trackedFiles.filter(f => f.isConfirmed),
    [trackedFiles]
  );

  // Check if all files are ready (complete or skipped, ignoring errors)
  const allFilesReady = useMemo(() => {
    const nonErrorFiles = trackedFiles.filter(f => f.metadataStatus !== MetadataStatus.ERROR);
    return nonErrorFiles.length > 0 && stats.incomplete === 0;
  }, [trackedFiles, stats.incomplete]);

  // Check if all non-error files have been confirmed
  const allFilesConfirmed = useMemo(() => {
    const nonErrorFiles = trackedFiles.filter(f => f.metadataStatus !== MetadataStatus.ERROR);
    return nonErrorFiles.length > 0 && nonErrorFiles.every(f => f.isConfirmed);
  }, [trackedFiles]);

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

  // Clear all files and error
  const clearAll = useCallback(() => {
    setTrackedFiles([]);
    setError(null);
    setUploadMode(UPLOAD_MODE.SONGS);
    setUploadContext({ album: null, artist: null, year: null, playlist: null, playlistId: null });
    setModeSelected(false);
    setWorkflowState({
      stage: UploadStage.PROCESS,
      reviewIndex: 0,
      isEditMode: false,
    });
  }, []);

  // Clear just the upload context (mode remains)
  const clearUploadContext = useCallback(() => {
    setUploadContext({ album: null, artist: null, year: null, playlist: null, playlistId: null });
  }, []);

  // Update metadata for a file and mark as complete
  const updateFileMetadata = useCallback((trackingId, metadata) => {
    setTrackedFiles(prev => prev.map(file => {
      if (file.trackingId === trackingId) {
        return {
          ...file,
          metadata: { ...file.metadata, ...metadata },
          metadataStatus: MetadataStatus.COMPLETE,
          metadataSource: 'manual', // Mark as manually edited
        };
      }
      return file;
    }));
  }, []);

  // Mark a file as confirmed by user
  const confirmFile = useCallback((trackingId) => {
    setTrackedFiles(prev => prev.map(file => {
      if (file.trackingId === trackingId) {
        return {
          ...file,
          isConfirmed: true,
        };
      }
      return file;
    }));
  }, []);

  // Unconfirm a file (for re-reviewing)
  const unconfirmFile = useCallback((trackingId) => {
    setTrackedFiles(prev => prev.map(file => {
      if (file.trackingId === trackingId) {
        return {
          ...file,
          isConfirmed: false,
        };
      }
      return file;
    }));
  }, []);

  // Unconfirm all files (for re-reviewing all)
  const unconfirmAllFiles = useCallback(() => {
    setTrackedFiles(prev => prev.map(file => ({
      ...file,
      isConfirmed: false,
    })));
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

  // Remove confirmed files (after saving to library)
  const removeConfirmedFiles = useCallback(() => {
    setTrackedFiles(prev => prev.filter(f => !f.isConfirmed));
  }, []);

  // Update workflow state (stage, reviewIndex, isEditMode)
  const updateWorkflowState = useCallback((updates) => {
    setWorkflowState(prev => ({ ...prev, ...updates }));
  }, []);

  // Reset workflow state to initial values
  const resetWorkflowState = useCallback(() => {
    setWorkflowState({
      stage: UploadStage.PROCESS,
      reviewIndex: 0,
      isEditMode: false,
    });
  }, []);

  const value = useMemo(() => ({
    // State
    trackedFiles,
    error,
    workflowState,
    uploadMode,
    uploadContext,
    modeSelected,
    
    // Computed
    stats,
    incompleteFiles,
    pendingConfirmation,
    confirmedFiles,
    allFilesReady,
    allFilesConfirmed,
    
    // Actions
    addFile,
    addFiles,
    setFiles,
    clearAll,
    updateFileMetadata,
    confirmFile,
    unconfirmFile,
    unconfirmAllFiles,
    removeFile,
    removeCompleteFiles,
    removeConfirmedFiles,
    updateWorkflowState,
    resetWorkflowState,
    setError,
    clearError: () => setError(null),
    setUploadMode,
    setUploadContext,
    clearUploadContext,
    setModeSelected,
  }), [
    trackedFiles,
    error,
    workflowState,
    uploadMode,
    uploadContext,
    modeSelected,
    stats,
    incompleteFiles,
    pendingConfirmation,
    confirmedFiles,
    allFilesReady,
    allFilesConfirmed,
    addFile,
    addFiles,
    setFiles,
    clearAll,
    updateFileMetadata,
    confirmFile,
    unconfirmFile,
    unconfirmAllFiles,
    removeFile,
    removeCompleteFiles,
    removeConfirmedFiles,
    updateWorkflowState,
    resetWorkflowState,
    clearUploadContext,
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
