/**
 * Toast Component
 * 
 * A dismissible notification popup that appears at the top of the screen.
 * Supports different variants (success, error, info) and auto-dismisses after a configurable duration.
 * 
 * @param {Object} props
 * @param {string} props.message - The message to display
 * @param {string} [props.variant='success'] - The variant: 'success', 'error', or 'info'
 * @param {boolean} props.visible - Whether the toast is visible
 * @param {function} props.onDismiss - Callback when toast is dismissed
 */

import React, { useEffect, useCallback } from 'react';
import styles from './Toast.module.css';

export default function Toast({ 
  message, 
  variant = 'success', 
  visible, 
  onDismiss 
}) {
  // Handle keyboard dismiss (Escape key)
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && visible) {
      onDismiss();
    }
  }, [visible, onDismiss]);

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, handleKeyDown]);

  if (!visible || !message) {
    return null;
  }

  const variantClass = styles[variant] || styles.success;

  return (
    <div className={`${styles.toast} ${variantClass}`}>
      <div className={styles.content}>
        <span className={styles.message}>{message}</span>
        <button 
          className={styles.dismissButton} 
          onClick={onDismiss}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    </div>
  );
}
