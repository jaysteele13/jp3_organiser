/**
 * useAutoSuggest Hook
 * 
 * Provides hybrid autofill suggestions for metadata fields:
 * 1. When field is empty: Shows filename-based heuristic suggestion
 * 2. When user starts typing: Shows library-based fuzzy matches
 * 
 * Accepts suggestions via Tab key.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { suggestFromFilename, findBestMatch } from '../utils';

/**
 * Suggestion source types
 */
export const SuggestionSource = {
  FILENAME: 'filename',
  LIBRARY: 'library',
};

/**
 * @param {string} filename - The source filename to generate suggestion from
 * @param {string} currentValue - Current input field value
 * @param {Object} options - Configuration options
 * @param {string[]} options.libraryEntries - Array of existing library entries to match against
 * @param {boolean} options.enableFilename - Whether to show filename suggestions (default: true)
 * @param {boolean} options.enableLibrary - Whether to show library suggestions (default: true)
 * @returns {Object} Hook state and handlers
 */
export function useAutoSuggest(filename, currentValue, options = {}) {
  const { 
    libraryEntries = [], 
    enableFilename = true,
    enableLibrary = true,
  } = options;

  const [isFilenameAccepted, setIsFilenameAccepted] = useState(false);

  // Generate filename-based suggestion (memoized, computed once)
  const filenameSuggestion = useMemo(() => {
    if (!enableFilename) return null;
    return suggestFromFilename(filename);
  }, [filename, enableFilename]);

  // Generate library-based suggestion based on current input
  const librarySuggestion = useMemo(() => {
    if (!enableLibrary || !currentValue || currentValue.trim().length === 0) {
      return null;
    }
    return findBestMatch(currentValue, libraryEntries);
  }, [currentValue, libraryEntries, enableLibrary]);

  // Determine current suggestion mode and value
  const { suggestion, source, showSuggestion } = useMemo(() => {
    const trimmedValue = currentValue?.trim() || '';
    
    // Mode 1: Empty field - show filename suggestion
    if (trimmedValue.length === 0) {
      if (isFilenameAccepted || !filenameSuggestion) {
        return { suggestion: null, source: null, showSuggestion: false };
      }
      return { 
        suggestion: filenameSuggestion, 
        source: SuggestionSource.FILENAME, 
        showSuggestion: true,
      };
    }
    
    // Mode 2: User is typing - show library suggestion
    if (librarySuggestion) {
      // Only show if library suggestion is different from what user typed
      // and starts with what they typed (prefix match for inline completion)
      const lowerValue = trimmedValue.toLowerCase();
      const lowerSuggestion = librarySuggestion.toLowerCase();
      
      if (lowerSuggestion !== lowerValue && lowerSuggestion.startsWith(lowerValue)) {
        return { 
          suggestion: librarySuggestion, 
          source: SuggestionSource.LIBRARY, 
          showSuggestion: true,
        };
      }
    }
    
    return { suggestion: null, source: null, showSuggestion: false };
  }, [currentValue, filenameSuggestion, librarySuggestion, isFilenameAccepted]);

  // Reset accepted state when filename changes
  useEffect(() => {
    setIsFilenameAccepted(false);
  }, [filename]);

  // Handler to accept the current suggestion
  const acceptSuggestion = useCallback(() => {
    if (showSuggestion && suggestion) {
      if (source === SuggestionSource.FILENAME) {
        setIsFilenameAccepted(true);
      }
      return suggestion;
    }
    return null;
  }, [showSuggestion, suggestion, source]);

  // Handler for Tab key press
  const handleKeyDown = useCallback((e, onAccept) => {
    if (e.key === 'Tab' && showSuggestion && suggestion) {
      e.preventDefault();
      if (source === SuggestionSource.FILENAME) {
        setIsFilenameAccepted(true);
      }
      onAccept(suggestion);
    }
  }, [showSuggestion, suggestion, source]);

  // Compute the inline completion text (the part after what user typed)
  const completionText = useMemo(() => {
    if (!showSuggestion || !suggestion || source !== SuggestionSource.LIBRARY) {
      return null;
    }
    const trimmedValue = currentValue?.trim() || '';
    if (suggestion.toLowerCase().startsWith(trimmedValue.toLowerCase())) {
      return suggestion.slice(trimmedValue.length);
    }
    return null;
  }, [showSuggestion, suggestion, source, currentValue]);

  return {
    suggestion: showSuggestion ? suggestion : null,
    source,
    completionText,
    acceptSuggestion,
    handleKeyDown,
    isFilenameAccepted,
  };
}
