import { useState, useEffect, useCallback } from 'react';
import { loadLibrary, listPlaylists } from '../services';

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
      // Fetch library and playlists in parallel
      const [libraryData, playlistsData] = await Promise.all([
        loadLibrary(libraryPath),
        listPlaylists(libraryPath).catch(() => []), // Gracefully handle missing playlists
      ]);

      // Combine into single library object
      setLibrary({
        ...libraryData,
        playlists: playlistsData,
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