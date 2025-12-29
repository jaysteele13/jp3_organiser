/**
 * useFileUpload Hook
 * 
 * Manages audio file selection, processing, and library saving.
 * 
 * Files are processed incrementally - each file appears in the UI
 * as soon as it completes, rather than waiting for all files.
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { processAudioFilesIncremental, MetadataStatus, saveToLibrary } from '../../../../../services';

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'm4a', 'ogg'];

export function useFileUpload(libraryPath) {
  const [trackedFiles, setTrackedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Processing progress state
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  
  // Ref for cancellation
  const cancelRef = useRef(false);

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

  // Select and process files incrementally
  const selectFiles = useCallback(async () => {
    try {
      setError(null);
      cancelRef.current = false;
      
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
      
      // Reset state for new batch
      setTrackedFiles([]);
      setIsProcessing(true);
      setProcessingProgress({ current: 0, total: paths.length });

      // Process files one at a time, appending each as it completes
      await processAudioFilesIncremental(paths, {
        onFileProcessed: (file, currentIndex, totalFiles) => {
          setTrackedFiles(prev => [...prev, file]);
          setProcessingProgress({ current: currentIndex + 1, total: totalFiles });
        },
        onFileError: (err, filePath, currentIndex) => {
          console.error(`Failed to process ${filePath}:`, err);
          // Could optionally add a placeholder file with error status
        },
        shouldCancel: () => cancelRef.current,
      });

      return true;
    } catch (err) {
      setError(err.toString());
      console.error('Failed to process files:', err);
      return false;
    } finally {
      setIsProcessing(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  }, []);

  // Cancel ongoing processing
  const cancelProcessing = useCallback(() => {
    cancelRef.current = true;
  }, []);

  // Clear all files and reset state
  const clearFiles = useCallback(() => {
    cancelRef.current = true;
    setTrackedFiles([]);
    setError(null);
    setSuccessMessage(null);
    setProcessingProgress({ current: 0, total: 0 });
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
    processingProgress,
    
    // Computed
    stats,
    incompleteFiles,
    allFilesReady,
    
    // Actions
    selectFiles,
    cancelProcessing,
    clearFiles,
    updateFileMetadata,
    removeFile,
    saveToLibrary: saveToLibraryHandler,
    clearError: () => setError(null),
    clearSuccess: () => setSuccessMessage(null),
  };
}
