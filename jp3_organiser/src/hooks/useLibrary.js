import { useState, useEffect, useCallback } from 'react';
import { loadLibrary, listPlaylists, loadPlaylist } from '../services';
import { getCachedLibrary, loadLibraryFromCache, invalidateLibraryCache, setCachedLibrary } from './libraryCache';
import { withPlaylistNames } from '../utils/songFilter';

export function useLibrary(libraryPath) {
  const [library, setLibrary] = useState(() => getCachedLibrary(libraryPath));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLibrary = useCallback(async (force = false) => {
    if (!libraryPath) return;
    if (!force) {
      const cached = getCachedLibrary(libraryPath);
      // Only reuse a complete library: the cache briefly holds one whose playlists are still loading
      if (cached?.playlists) {
        setLibrary(cached);
        return cached;
      }
    }

    setIsLoading(true);
    setError(null);
    try {
      const [libraryData, playlistSummaries] = await Promise.all([
        loadLibraryFromCache(libraryPath, () => loadLibrary(libraryPath)),
        listPlaylists(libraryPath).catch(() => []),
      ]);

      let fullPlaylists = [];
      if (playlistSummaries.length > 0) {
        fullPlaylists = await Promise.all(
          playlistSummaries.map((summary) =>
            loadPlaylist(libraryPath, summary.id).catch(() => ({
              ...summary,
              songIds: [],
            }))
          )
        );
      }

      // Songs carry their playlists' names so the command bar's "playlist=" can filter on them
      const nextLibrary = {
        ...libraryData,
        songs: withPlaylistNames(libraryData.songs || [], fullPlaylists),
        playlists: fullPlaylists,
      };
      setLibrary(nextLibrary);
      setCachedLibrary(libraryPath, nextLibrary);
      return nextLibrary;
    } catch (err) {
      setError(err.toString());
      setLibrary(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [libraryPath]);

  useEffect(() => {
    if (!libraryPath) return;
    fetchLibrary().catch(() => {});
  }, [fetchLibrary, libraryPath]);

  return {
    library,
    isLoading,
    error,
    handleRefresh: () => fetchLibrary(true),
    invalidateCache: () => invalidateLibraryCache(libraryPath),
  };
}