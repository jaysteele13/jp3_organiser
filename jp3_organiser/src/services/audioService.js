/**
 * Audio Service
 * 
 * Handles audio file processing, metadata extraction, and fingerprinting.
 * 
 * Workflow:
 * 1. User selects files -> processAudioFilesIncremental() processes each file
 * 2. ID3 metadata is extracted with AcoustID fingerprint matching
 * 3. UI shows files as they complete for better UX
 * 4. Manual confirmation for incomplete files
 * 5. Write to library.bin
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Metadata extraction status for a tracked file.
 * @readonly
 * @enum {string}
 */
export const MetadataStatus = {
  /** Waiting to be processed */
  PENDING: 'pending',
  /** All required fields present (artist, album, title) */
  COMPLETE: 'complete',
  /** Missing one or more required fields */
  INCOMPLETE: 'incomplete',
  /** Failed to read file or parse metadata */
  ERROR: 'error',
};

/**
 * Rate limit delay between API calls (ms).
 * AcoustID allows 3 requests/second, we use 500ms for safety margin.
 */
export const API_RATE_LIMIT_DELAY = 500;

/**
 * Process a single audio file with fingerprinting and AcoustID lookup.
 * 
 * This is the preferred method for processing files as it allows
 * the UI to show files as they complete rather than waiting for
 * all files to finish.
 * 
 * @param {string} filePath - Absolute file path
 * @returns {Promise<TrackedAudioFile>} Processed file with metadata
 */
export async function processSingleAudioFile(filePath) {
  return await invoke('process_single_audio_file', { filePath });
}

/**
 * Process multiple audio files incrementally with rate limiting.
 * 
 * Calls the backend for each file with a delay between calls to
 * respect API rate limits. Files are yielded as they complete.
 * 
 * @param {string[]} filePaths - Array of absolute file paths
 * @param {Object} callbacks - Callback functions
 * @param {function(TrackedAudioFile, number, number): void} callbacks.onFileProcessed 
 *   Called when each file completes: (file, currentIndex, totalFiles)
 * @param {function(Error, string, number, number): void} [callbacks.onFileError]
 *   Called when a file fails: (error, filePath, currentIndex, totalFiles)
 * @param {function(): boolean} [callbacks.shouldCancel]
 *   Return true to cancel remaining files
 * @returns {Promise<TrackedAudioFile[]>} All successfully processed files
 */
export async function processAudioFilesIncremental(filePaths, callbacks) {
  const { onFileProcessed, onFileError, shouldCancel } = callbacks;
  const processedFiles = [];
  const totalFiles = filePaths.length;

  for (let i = 0; i < filePaths.length; i++) {
    // Check for cancellation
    if (shouldCancel && shouldCancel()) {
      break;
    }

    // Rate limiting: wait before each call except the first
    if (i > 0) {
      await sleep(API_RATE_LIMIT_DELAY);
    }

    const filePath = filePaths[i];

    try {
      const file = await processSingleAudioFile(filePath);
      processedFiles.push(file);
      
      if (onFileProcessed) {
        onFileProcessed(file, i, totalFiles);
      }
    } catch (error) {
      if (onFileError) {
        onFileError(error, filePath, i, totalFiles);
      }
      // Continue processing remaining files even if one fails
    }
  }

  return processedFiles;
}

/**
 * Sleep for a specified number of milliseconds.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

