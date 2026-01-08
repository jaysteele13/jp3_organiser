/**
 * Formatters Utility
 * 
 * Pure formatting functions for display purposes.
 */

/**
 * Format bytes into human-readable file size.
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size (e.g., "1.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format duration in seconds to mm:ss format.
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "3:45")
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Convert a ParsedSong from library to TrackedAudioFile format.
 * This allows reusing MetadataForm for editing existing songs.
 * 
 * @param {Object} song - ParsedSong object from library
 * @returns {Object} TrackedAudioFile-compatible object for MetadataForm
 */
export function parsedSongToTrackedFile(song) {
  return {
    trackingId: song.id.toString(),
    fileName: song.title,
    filePath: song.path,
    metadata: {
      title: song.title,
      artist: song.artistName,
      album: song.albumName,
      year: song.year || null,
      trackNumber: song.trackNumber,
      durationSecs: song.durationSec,
    }
  };
}
