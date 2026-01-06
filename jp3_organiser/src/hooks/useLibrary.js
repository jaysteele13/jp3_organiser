import { useState, useEffect, useCallback } from 'react';
import { loadLibrary, listPlaylists, loadPlaylist } from '../services';

/**
 * useLibrary Hook
 * 
 * Fetches and manages library data including songs, albums, artists, and playlists.
 * All data is loaded together to maintain consistency.
 * 
 * @param {string} libraryPath - The base library directory path
 * @returns {Object} Library state and actions
 */
export function useLibrary(libraryPath) {
  const [library, setLibrary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLibrary = useCallback(async () => {
    if (!libraryPath) return;

    setIsLoading(true);
    setError(null);
    try {
      // Fetch library and playlist summaries in parallel
      const [libraryData, playlistSummaries] = await Promise.all([
        loadLibrary(libraryPath),
        listPlaylists(libraryPath).catch(() => []), // Gracefully handle missing playlists
      ]);

      // Fetch full playlist data (with songIds) for each playlist
      let fullPlaylists = [];
      if (playlistSummaries.length > 0) {
        fullPlaylists = await Promise.all(
          playlistSummaries.map(summary => 
            loadPlaylist(libraryPath, summary.id).catch(() => ({
              ...summary,
              songIds: [], // Fallback if individual playlist fails to load
            }))
          )
        );
      }

      // Combine into single library object
      setLibrary({
        ...libraryData,
        playlists: fullPlaylists,
      });
    } catch (err) {
      setError(err.toString());
      setLibrary(null);
    } finally {
      setIsLoading(false);
    }
  }, [libraryPath]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  return { library, isLoading, error, handleRefresh: fetchLibrary };
}