import { useState, useEffect, useCallback } from 'react';
import { loadLibrary } from '../services';

export function useLibrary(libraryPath) {
  const [library, setLibrary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLibrary = useCallback(async () => {
    if (!libraryPath) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await loadLibrary(libraryPath);
      setLibrary(data);
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