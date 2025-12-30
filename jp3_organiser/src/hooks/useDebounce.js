/**
 * useDebounce Hook
 * 
 * Debounces a value by delaying updates until after a specified delay
 * has passed since the last change. Useful for reducing expensive
 * operations triggered by rapid user input.
 * 
 * @param {any} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default: 150ms)
 * @returns {any} The debounced value
 */

import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 150) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set up timeout to update debounced value after delay
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Clean up timeout if value changes before delay completes
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]);

  return debouncedValue;
}
