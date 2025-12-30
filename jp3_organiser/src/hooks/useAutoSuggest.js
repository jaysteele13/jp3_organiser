/**
 * useAutoSuggest Hook
 * 
 * Provides autofill suggestions for metadata fields based on filename.
 * Generates a suggestion once on mount and allows accepting it via Tab key.
 * 
 * Designed for future extensibility with library-based fuzzy matching.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { suggestFromFilename } from '../utils';

/**
 * @param {string} filename - The source filename to generate suggestion from
 * @param {string} currentValue - Current input field value
 * @returns {Object} Hook state and handlers
 */
export function useAutoSuggest(filename, currentValue) {
  const [isAccepted, setIsAccepted] = useState(false);

  // Generate suggestion once from filename (memoized)
  const suggestion = useMemo(() => {
    return suggestFromFilename(filename);
  }, [filename]);

  // Determine if we should show the suggestion
  const shouldShowSuggestion = useMemo(() => {
    // Don't show if already accepted
    if (isAccepted) return false;
    
    // Don't show if no suggestion available
    if (!suggestion) return false;
    
    // Don't show if user has typed something
    if (currentValue && currentValue.trim().length > 0) return false;
    
    return true;
  }, [suggestion, currentValue, isAccepted]);

  // Reset accepted state when filename changes
  useEffect(() => {
    setIsAccepted(false);
  }, [filename]);

  // Handler to accept the suggestion
  const acceptSuggestion = useCallback(() => {
    if (shouldShowSuggestion && suggestion) {
      setIsAccepted(true);
      return suggestion;
    }
    return null;
  }, [shouldShowSuggestion, suggestion]);

  // Handler for Tab key press
  const handleKeyDown = useCallback((e, onAccept) => {
    if (e.key === 'Tab' && shouldShowSuggestion && suggestion) {
      e.preventDefault();
      setIsAccepted(true);
      onAccept(suggestion);
    }
  }, [shouldShowSuggestion, suggestion]);

  return {
    suggestion: shouldShowSuggestion ? suggestion : null,
    acceptSuggestion,
    handleKeyDown,
    isAccepted,
  };
}
