/**
 * useFileUpload Hook
 * 
 * Manages audio file selection, processing, and library saving.
 * Extracts file management logic from UploadFile component.
 */

import { useState, useMemo, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { processAudioFiles, MetadataStatus, saveToLibrary } from '../../../../../services';

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'm4a', 'ogg'];

export function useFileUpload(libraryPath) {
  const [trackedFiles, setTrackedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  // Check if all files are ready (complete or skipped)
  const allFilesReady = useMemo(() => 
    trackedFiles.length > 0 && stats.incomplete === 0,
    [trackedFiles.length, stats.incomplete]
  );

  // Select and process files
  const selectFiles = useCallback(async () => {
    try {
      setError(null);
      
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [{
          name: 'Audio Files',
          extensions: AUDIO_EXTENSIONS,
        }],
      });

      if (!selected) return false;

      const paths = Array.isArray(selected) ? selected : [selected];
      setIsProcessing(true);

      const result = await processAudioFiles(paths);
      setTrackedFiles(result.files);
      return true;
    } catch (err) {
      setError(err.toString());
      console.error('Failed to process files:', err);
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Clear all files and reset state
  const clearFiles = useCallback(() => {
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

  // Save complete files to library
  const saveToLibraryHandler = useCallback(async () => {
    if (!libraryPath) {
      setError('Library path not configured');
      return false;
    }

    const completeFiles = trackedFiles.filter(
      f => f.metadataStatus === MetadataStatus.COMPLETE
    );

    if (completeFiles.length === 0) {
      setError('No complete files to add');
      return false;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const filesToSave = completeFiles.map(f => ({
        sourcePath: f.filePath,
        metadata: f.metadata,
      }));

      const result = await saveToLibrary(libraryPath, filesToSave);

      setSuccessMessage(
        `Added ${result.filesSaved} file(s) to library. ` +
        `${result.artistsAdded} artist(s), ${result.albumsAdded} album(s), ${result.songsAdded} song(s).`
      );

      // Clear saved files from the list
      setTrackedFiles(prev => 
        prev.filter(f => f.metadataStatus !== MetadataStatus.COMPLETE)
      );
      return true;
    } catch (err) {
      setError(`Failed to save to library: ${err}`);
      console.error('Failed to save to library:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [libraryPath, trackedFiles]);

  return {
    // State
    trackedFiles,
    isProcessing,
    isSaving,
    error,
    successMessage,
    
    // Computed
    stats,
    incompleteFiles,
    allFilesReady,
    
    // Actions
    selectFiles,
    clearFiles,
    updateFileMetadata,
    removeFile,
    saveToLibrary: saveToLibraryHandler,
    clearError: () => setError(null),
    clearSuccess: () => setSuccessMessage(null),
  };
}
