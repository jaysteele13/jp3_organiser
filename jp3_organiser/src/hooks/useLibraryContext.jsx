/**
 * LibraryContext
 * 
 * Provides library data throughout the app via React Context.
 * Eliminates prop drilling of library data through component trees.
 * 
 * Usage:
 * 1. Wrap your app with <LibraryProvider libraryPath={path}>
 * 2. Use useLibraryContext() hook in any descendant component
 * 
 * The context provides the same interface as useLibrary hook:
 * - library: The parsed library data (or null)
 * - isLoading: Whether library is being fetched
 * - error: Any error that occurred during fetch
 * - refresh: Function to manually refresh library data
 */

import { createContext, useContext, useMemo } from 'react';
import { useLibrary } from './useLibrary';

// =============================================================================
// Context
// =============================================================================

const LibraryContext = createContext(null);

// =============================================================================
// Provider Component
// =============================================================================

/**
 * Provider component that fetches and shares library data.
 * 
 * @param {Object} props
 * @param {string|null} props.libraryPath - Path to the library (null to skip fetching)
 * @param {React.ReactNode} props.children - Child components
 */
export function LibraryProvider({ libraryPath, children }) {
  const { library, isLoading, error, handleRefresh } = useLibrary(libraryPath);

  const value = useMemo(() => ({
    library,
    isLoading,
    error,
    refresh: handleRefresh,
    // Convenience: check if library is ready to use
    isReady: !isLoading && !error && library !== null,
  }), [library, isLoading, error, handleRefresh]);

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access the library context.
 * Must be used within a LibraryProvider.
 * 
 * @returns {Object} Library context value
 * @throws {Error} If used outside of LibraryProvider
 */
export function useLibraryContext() {
  const context = useContext(LibraryContext);
  
  if (context === null) {
    throw new Error('useLibraryContext must be used within a LibraryProvider');
  }
  
  return context;
}
