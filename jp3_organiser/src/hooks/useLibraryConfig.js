/**
 * useLibraryConfig Hook
 * 
 * Manages the library configuration state, including loading from
 * and saving to persistent storage via Tauri commands.
 * 
 * This hook provides:
 * - libraryPath: The current configured path (or null)
 * - isLoading: Whether the initial load is in progress
 * - error: Any error that occurred
 * - isConfigured: Boolean shorthand for whether path is set
 * - saveLibraryPath: Function to save a new path
 * - clearLibraryPath: Function to clear the saved path
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  getLibraryPath, 
  setLibraryPath as setLibraryPathService, 
  clearLibraryPath as clearLibraryPathService 
} from '../services';

export function useLibraryConfig() {
  const [libraryPath, setLibraryPath] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load the library path on mount
  useEffect(() => {
    async function loadLibraryPath() {
      try {
        setIsLoading(true);
        setError(null);
        const path = await getLibraryPath();
        setLibraryPath(path);
      } catch (err) {
        setError(err.toString());
        console.error('Failed to load library path:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadLibraryPath();
  }, []);

  // Save a new library path
  const saveLibraryPath = useCallback(async (path) => {
    try {
      setError(null);
      await setLibraryPathService(path);
      setLibraryPath(path);
      return true;
    } catch (err) {
      setError(err.toString());
      console.error('Failed to save library path:', err);
      return false;
    }
  }, []);

  // Clear the library path
  const clearPath = useCallback(async () => {
    try {
      setError(null);
      await clearLibraryPathService();
      setLibraryPath(null);
      return true;
    } catch (err) {
      setError(err.toString());
      console.error('Failed to clear library path:', err);
      return false;
    }
  }, []);

  return {
    libraryPath,
    isLoading,
    error,
    isConfigured: libraryPath !== null,
    saveLibraryPath,
    clearLibraryPath: clearPath,
  };
}
