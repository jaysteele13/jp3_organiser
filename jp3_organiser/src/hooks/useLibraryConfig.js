/**
 * useLibraryConfig Hook
 * 
 * Manages the library configuration state, including loading from
 * and saving to persistent storage via Tauri commands.
 * 
 * When a library path is saved, this hook automatically initializes
 * the JP3 directory structure (jp3/music/, jp3/metadata/, jp3/playlists/).
 * 
 * This hook provides:
 * - libraryPath: The current configured path (or null)
 * - libraryInfo: Information about the initialized library
 * - isLoading: Whether the initial load is in progress
 * - isInitializing: Whether directory initialization is in progress
 * - error: Any error that occurred
 * - isConfigured: Boolean shorthand for whether path is set
 * - saveLibraryPath: Function to save a new path (auto-initializes)
 * - clearLibraryPath: Function to clear the saved path
 * - refreshLibraryInfo: Function to refresh library info
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  getLibraryPath, 
  setLibraryPath as setLibraryPathService, 
  clearLibraryPath as clearLibraryPathService,
  initializeLibrary,
  getLibraryInfo
} from '../services';

export function useLibraryConfig() {
  const [libraryPath, setLibraryPath] = useState(null);
  const [libraryInfo, setLibraryInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState(null);

  // Fetch library info for a given path
  const fetchLibraryInfo = useCallback(async (path) => {
    if (!path) {
      setLibraryInfo(null);
      return null;
    }
    try {
      const info = await getLibraryInfo(path);
      setLibraryInfo(info);
      return info;
    } catch (err) {
      console.error('Failed to fetch library info:', err);
      return null;
    }
  }, []);

  // Load the library path on mount
  useEffect(() => {
    async function loadLibraryPath() {
      try {
        setIsLoading(true);
        setError(null);
        const path = await getLibraryPath();
        setLibraryPath(path);
        
        // Also fetch library info if path exists
        if (path) {
          await fetchLibraryInfo(path);
        }
      } catch (err) {
        setError(err.toString());
        console.error('Failed to load library path:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadLibraryPath();
  }, [fetchLibraryInfo]);

  // Save a new library path and initialize the directory structure
  const saveLibraryPath = useCallback(async (path) => {
    try {
      setError(null);
      setIsInitializing(true);

      // Save the path first
      await setLibraryPathService(path);
      setLibraryPath(path);

      // Initialize the JP3 directory structure
      await initializeLibrary(path);

      // Fetch updated library info
      await fetchLibraryInfo(path);

      return true;
    } catch (err) {
      setError(err.toString());
      console.error('Failed to save/initialize library:', err);
      return false;
    } finally {
      setIsInitializing(false);
    }
  }, [fetchLibraryInfo]);

  // Clear the library path
  const clearPath = useCallback(async () => {
    try {
      setError(null);
      await clearLibraryPathService();
      setLibraryPath(null);
      setLibraryInfo(null);
      return true;
    } catch (err) {
      setError(err.toString());
      console.error('Failed to clear library path:', err);
      return false;
    }
  }, []);

  // Manually refresh library info
  const refreshLibraryInfo = useCallback(async () => {
    if (libraryPath) {
      return await fetchLibraryInfo(libraryPath);
    }
    return null;
  }, [libraryPath, fetchLibraryInfo]);

  return {
    libraryPath,
    libraryInfo,
    isLoading,
    isInitializing,
    error,
    isConfigured: libraryPath !== null,
    isInitialized: libraryInfo?.initialized ?? false,
    saveLibraryPath,
    clearLibraryPath: clearPath,
    refreshLibraryInfo,
  };
}
