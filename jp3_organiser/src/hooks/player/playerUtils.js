/**
 * Player Utility Functions
 * 
 * Pure helper functions for the player system.
 */

/**
 * Get MIME type from file extension.
 */
export function getMimeType(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    opus: 'audio/opus',
    webm: 'audio/webm',
  };
  return mimeTypes[ext] || 'audio/mpeg';
}

/**
 * Shuffle array using Fisher-Yates algorithm.
 */
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Repeat mode constants.
 */
export const REPEAT_MODE = {
  OFF: 'off',
  ALL: 'all',
  ONE: 'one',
};
