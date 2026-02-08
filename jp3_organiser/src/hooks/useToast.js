import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useToast Hook
 * 
 * Manages toast notification state with auto-dismiss functionality.
 * 
 * @param {number} [duration=5000] - Duration in ms before auto-dismiss (default 5 seconds)
 * @returns {Object} Toast state and controls
 * @returns {boolean} .visible - Whether the toast is visible
 * @returns {string} .message - The current message
 * @returns {string} .variant - The current variant ('success', 'error', 'info')se
 * @returns {function} .showToast - Function to show a toast (message, variant?)
 * @returns {function} .hideToast - Function to hide the toast
 */
export function useToast(duration = 5000) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [variant, setVariant] = useState('success');
  const timerRef = useRef(null);

  // Clear any existing timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Hide the toast
  const hideToast = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  // Show a toast with optional variant
  const showToast = useCallback((msg, toastVariant = 'success') => {
    // Clear any existing timer first
    clearTimer();
    
    // Set the new toast state
    setMessage(msg);
    setVariant(toastVariant);
    setVisible(true);

    // Set auto-dismiss timer
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, duration);
  }, [duration, clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return {
    visible,
    message,
    variant,
    showToast,
    hideToast,
  };
}
