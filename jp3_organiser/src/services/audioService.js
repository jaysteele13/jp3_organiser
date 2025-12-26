/**
 * Audio Service
 * 
 * Handles audio file processing, metadata extraction, and tracking.
 * 
 * Workflow:
 * 1. User selects files -> processAudioFiles() assigns tracking IDs
 * 2. ID3 metadata is extracted -> status becomes Complete/Incomplete
 * 3. (Future) AI/API enrichment for incomplete files
 * 4. (Future) Manual confirmation for remaining incomplete
 * 5. (Future) Duplicate detection
 * 6. (Future) Write to library.bin
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
 * Process a list of audio file paths.
 * Assigns tracking IDs and extracts ID3 metadata.
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
 * Get metadata for a single audio file.
 * 
 * @param {string} filePath - Absolute file path
 * @returns {Promise<TrackedAudioFile>} Tracked file with metadata
 */
export async function getAudioMetadata(filePath) {
  return await invoke('get_audio_metadata', { filePath });
}

