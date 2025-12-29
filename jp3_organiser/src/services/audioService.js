/**
 * Audio Service
 * 
 * Handles audio file processing, metadata extraction, and tracking.
 * 
 * Workflow:
 * 1. User selects files -> processAudioFiles() assigns tracking IDs
 * 2. ID3 metadata is extracted -> status becomes Complete/Incomplete
 * 3. AcoustID API lookup for fingerprint matching
 * 4. Manual confirmation for remaining incomplete files
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
 * @param {function(Error, string, number): void} [callbacks.onFileError]
 *   Called when a file fails: (error, filePath, currentIndex)
 * @param {function(): boolean} [callbacks.shouldCancel]
 *   Return true to cancel remaining files
 * @returns {Promise<TrackedAudioFile[]>} All processed files
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
        onFileError(error, filePath, i);
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

/**
 * Process a list of audio file paths (batch mode - legacy).
 * Assigns tracking IDs and extracts ID3 metadata.
 * 
 * Note: Consider using processAudioFilesIncremental() instead
 * for better UX with progress updates.
 * 
 * @param {string[]} filePaths - Array of absolute file paths
 * @returns {Promise<ProcessedFilesResult>} Result containing all tracked files
 * 
 * @typedef {Object} ProcessedFilesResult
 * @property {TrackedAudioFile[]} files - All processed files
 * @property {number} completeCount - Files with complete metadata
 * @property {number} incompleteCount - Files with incomplete metadata
 * @property {number} errorCount - Files with errors
 * 
 * @typedef {Object} TrackedAudioFile
 * @property {string} trackingId - Unique ID for this session
 * @property {string} filePath - Original file path
 * @property {string} fileName - Just the filename
 * @property {string} fileExtension - File extension (mp3, wav, etc.)
 * @property {number} fileSize - Size in bytes
 * @property {MetadataStatus} metadataStatus - Current status
 * @property {AudioMetadata} metadata - Extracted metadata
 * @property {string|null} errorMessage - Error message if status is error
 * 
 * @typedef {Object} AudioMetadata
 * @property {string|null} title - Song title
 * @property {string|null} artist - Artist name
 * @property {string|null} album - Album name
 * @property {number|null} trackNumber - Track number
 * @property {number|null} year - Release year
 * @property {number|null} durationSecs - Duration in seconds
 */
export async function processAudioFiles(filePaths) {
  return await invoke('process_audio_files', { filePaths });
}

/**
 * Get metadata for a single audio file (ID3 only, no AcoustID).
 * 
 * @param {string} filePath - Absolute file path
 * @returns {Promise<TrackedAudioFile>} Tracked file with metadata
 */
export async function getAudioMetadata(filePath) {
  return await invoke('get_audio_metadata', { filePath });
}

