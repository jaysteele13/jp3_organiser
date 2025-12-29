/**
 * NavigationControls Component
 * 
 * Navigation and action buttons for the review screen.
 * Includes previous/next, confirm/remove, and edit buttons.
 */

import React from 'react';
import styles from '../ReviewScreen.module.css';

export default function NavigationControls({
  currentPosition,
  totalPending,
  canGoPrevious,
  canGoNext,
  isEditMode,
  onPrevious,
  onNext,
  onConfirm,
  onRemove,
  onEdit,
}) {
  return (
    <div className={styles.navigationControls}>
      {/* Progress indicator */}
      <div className={styles.progressIndicator}>
        <span className={styles.progressText}>
          {currentPosition} of {totalPending} remaining
        </span>
      </div>

      {/* Navigation arrows */}
      <div className={styles.navArrows}>
        <button 
          className={styles.navButton}
          onClick={onPrevious}
          disabled={!canGoPrevious}
          title="Previous file"
        >
          &larr; Previous
        </button>
        <button 
          className={styles.navButton}
          onClick={onNext}
          disabled={!canGoNext}
          title="Next file"
        >
          Next &rarr;
        </button>
      </div>

      {/* Action buttons */}
      <div className={styles.actionButtons}>
        <button 
          className={styles.confirmButton}
          onClick={onConfirm}
          title="Confirm details (Shift+Enter)"
        >
          Confirm Details
        </button>
        
        <button 
          className={styles.editButton}
          onClick={onEdit}
          disabled={isEditMode}
        >
          Edit
        </button>
        
        <button 
          className={styles.removeButton}
          onClick={onRemove}
          title="Remove from list"
        >
          Remove
        </button>
      </div>

      {/* Keyboard hint */}
      <div className={styles.keyboardHint}>
        <kbd>Shift</kbd> + <kbd>Enter</kbd> to confirm
      </div>
    </div>
  );
}
