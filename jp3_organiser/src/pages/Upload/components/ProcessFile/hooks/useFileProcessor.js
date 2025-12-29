/**
 * useFileProcessor Hook
 * 
 * Manages audio file selection and processing.
 * Extracts the file processing logic from the original useFileUpload hook.
 * 
 * This hook handles:
 * - File selection via native dialog
 * - Incremental processing with rate limiting
 * - Progress tracking
 * - Cancellation support
 */

import { useState, useCallback, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { processAudioFilesIncremental, MetadataStatus } from '../../../../../services';
import { useUploadCache } from '../../../../../hooks';

const AUDIO_EXTENSIONS = ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus'];

/**
 * Metadata source types for tracking how metadata was obtained.
 */
export const MetadataSource = {
  /** Metadata source not yet determined */
  UNKNOWN: 'unknown',
  /** Metadata from ID3 tags */
  ID3: 'id3',
  /** Metadata from AcoustID API */
  ACOUSTID: 'acoustid',
  /** Metadata entered manually by user */
  MANUAL: 'manual',
};

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
    metadataSource: MetadataSource.UNKNOWN,
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

/**
 * Determine the metadata source based on the processed file.
 * @param {Object} file - Processed file from backend
 * @returns {string} MetadataSource value
 */
function determineMetadataSource(file) {
  if (file.metadataStatus === MetadataStatus.ERROR) {
    return MetadataSource.UNKNOWN;
  }
  
  // If we have complete metadata, it came from either ID3 or AcoustID
  // The backend processes ID3 first, then AcoustID
  // For now, we'll mark it as automated if complete
  if (file.metadataStatus === MetadataStatus.COMPLETE) {
    // Check if it's an MP3 - likely ID3
    if (file.fileExtension === 'mp3') {
      return MetadataSource.ID3;
    }
    // Other formats use AcoustID
    return MetadataSource.ACOUSTID;
  }
  
  return MetadataSource.UNKNOWN;
}

/**
 * Enhance a processed file with metadata source information.
 * @param {Object} file - Processed file from backend
 * @returns {Object} File with metadataSource added
 */
function enhanceFileWithSource(file) {
  return {
    ...file,
    metadataSource: determineMetadataSource(file),
    isConfirmed: false, // User hasn't confirmed yet
  };
}

export function useFileProcessor() {
  const cache = useUploadCache();
  
  // Local state (transient)
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0 });
  
  // Ref for cancellation
  const cancelRef = useRef(false);

  // Check if all files are processed (not still processing)
  const isProcessingComplete = !isProcessing && cache.trackedFiles.length > 0;

  // Select and process files incrementally
  const selectFiles = useCallback(async () => {
    try {
      cache.clearError();
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
          const enhancedFile = enhanceFileWithSource(file);
          cache.addFile(enhancedFile);
          setProcessingProgress({ current: currentIndex + 1, total: totalFiles });
        },
        onFileError: (err, filePath, currentIndex, totalFiles) => {
          console.error(`Failed to process ${filePath}:`, err);
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
    setProcessingProgress({ current: 0, total: 0 });
  }, [cache]);

  return {
    // State
    trackedFiles: cache.trackedFiles,
    error: cache.error,
    isProcessing,
    processingProgress,
    
    // Computed
    stats: cache.stats,
    isProcessingComplete,
    
    // Actions
    selectFiles,
    cancelProcessing,
    clearFiles,
    clearError: cache.clearError,
  };
}
