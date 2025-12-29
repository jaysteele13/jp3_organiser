/**
 * useFileUpload Hook
 * 
 * Manages audio file selection, processing, and library saving.
 * 
 * Files are processed incrementally - each file appears in the UI
 * as soon as it completes, rather than waiting for all files.
 * Failed files are also shown with error status.
 * 
 * State is persisted via UploadCacheContext so files remain
 * available when navigating away and back.
 */

import { useState, useCallback, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { processAudioFilesIncremental, MetadataStatus, saveToLibrary } from '../../../../../services';
import { useUploadCache } from '../../../../../hooks';

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'm4a', 'ogg'];

/**
 * Extract filename from a file path.
 * @param {string} filePath - Full file path
 * @returns {string} Just the filename
 */
function getFileName(filePath) {
  return filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
}

/**
 * Extract file extension from a file path.
 * @param {string} filePath - Full file path
 * @returns {string} File extension without dot
 */
function getFileExtension(filePath) {
  const fileName = getFileName(filePath);
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.slice(lastDot + 1).toLowerCase() : '';
}

/**
 * Create a placeholder file entry for failed processing.
 * @param {string} filePath - Original file path
 * @param {Error|string} error - The error that occurred
 * @returns {Object} TrackedAudioFile-like object with error status
 */
function createErrorFile(filePath, error) {
  return {
    trackingId: crypto.randomUUID(),
    filePath,
    fileName: getFileName(filePath),
    fileExtension: getFileExtension(filePath),
    fileSize: 0,
    metadataStatus: MetadataStatus.ERROR,
    metadata: {
      title: null,
      artist: null,
      album: null,
      trackNumber: null,
      year: null,
      durationSecs: null,
    },
    errorMessage: error?.toString() || 'Unknown error',
  };
}

export function useFileUpload(libraryPath) {
  // Get persisted state from context
  const cache = useUploadCache();
  
  // Local state (not persisted - transient)
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  const [successMessage, setSuccessMessage] = useState(null);
  
  // Ref for cancellation
  const cancelRef = useRef(false);

  // Select and process files incrementally
  const selectFiles = useCallback(async () => {
    try {
      cache.clearError();
      setSuccessMessage(null);
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
      cache.setFiles([]);
      setIsProcessing(true);
      setProcessingProgress({ current: 0, total: paths.length });

      // Process files one at a time, appending each as it completes
      await processAudioFilesIncremental(paths, {
        onFileProcessed: (file, currentIndex, totalFiles) => {
          cache.addFile(file);
          setProcessingProgress({ current: currentIndex + 1, total: totalFiles });
        },
        onFileError: (err, filePath, currentIndex, totalFiles) => {
          console.error(`Failed to process ${filePath}:`, err);
          // Add placeholder file with error status so user can see what failed
          const errorFile = createErrorFile(filePath, err);
          cache.addFile(errorFile);
          setProcessingProgress({ current: currentIndex + 1, total: totalFiles });
        },
        shouldCancel: () => cancelRef.current,
      });

      return true;
    } catch (err) {
      cache.setError(err.toString());
      console.error('Failed to process files:', err);
      return false;
    } finally {
      setIsProcessing(false);
      setProcessingProgress({ current: 0, total: 0 });
    }
  }, [cache]);

  // Cancel ongoing processing
  const cancelProcessing = useCallback(() => {
    cancelRef.current = true;
  }, []);

  // Clear all files and reset state
  const clearFiles = useCallback(() => {
    cancelRef.current = true;
    cache.clearAll();
    setSuccessMessage(null);
    setProcessingProgress({ current: 0, total: 0 });
  }, [cache]);

  // Save complete files to library
  const saveToLibraryHandler = useCallback(async () => {
    if (!libraryPath) {
      cache.setError('Library path not configured');
      return false;
    }

    const completeFiles = cache.trackedFiles.filter(
      f => f.metadataStatus === MetadataStatus.COMPLETE
    );

    if (completeFiles.length === 0) {
      cache.setError('No complete files to add');
      return false;
    }

    try {
      setIsSaving(true);
      cache.clearError();
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
      cache.removeCompleteFiles();
      return true;
    } catch (err) {
      cache.setError(`Failed to save to library: ${err}`);
      console.error('Failed to save to library:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [libraryPath, cache]);

  return {
    // State (from cache - persisted)
    trackedFiles: cache.trackedFiles,
    error: cache.error,
    
    // State (local - transient)
    isProcessing,
    isSaving,
    processingProgress,
    successMessage,
    
    // Computed (from cache)
    stats: cache.stats,
    incompleteFiles: cache.incompleteFiles,
    allFilesReady: cache.allFilesReady,
    
    // Actions
    selectFiles,
    cancelProcessing,
    clearFiles,
    updateFileMetadata: cache.updateFileMetadata,
    removeFile: cache.removeFile,
    saveToLibrary: saveToLibraryHandler,
    clearError: cache.clearError,
    clearSuccess: () => setSuccessMessage(null),
  };
}
