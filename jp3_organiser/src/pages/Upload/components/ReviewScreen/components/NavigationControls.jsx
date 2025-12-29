/**
 * NavigationControls Component
 * 
 * Navigation and action buttons for the review screen.
 * Includes previous/next, confirm/remove, and edit buttons.
 * 
 * Supports reviewAll mode where files can be un-confirmed.
 */

import React from 'react';
import styles from '../ReviewScreen.module.css';

export default function NavigationControls({
  currentPosition,
  totalFiles,
  canGoPrevious,
  canGoNext,
  isConfirmed,
  reviewAll,
  onPrevious,
  onNext,
  onConfirm,
  onUnconfirm,
  onRemove,
  onEdit,
}) {
  return (
    <div className={styles.navigationControls}>
      {/* Progress indicator */}
      <div className={styles.progressIndicator}>
        <span className={styles.progressText}>
          {reviewAll 
            ? `${currentPosition} of ${totalFiles} files`
            : `${currentPosition} of ${totalFiles} remaining`
          }
        </span>
        {reviewAll && isConfirmed && (
          <span className={styles.confirmedBadge}>Confirmed</span>
        )}
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
        {/* Show confirm/unconfirm based on state */}
        {reviewAll && isConfirmed ? (
          <button 
            className={styles.unconfirmButton}
            onClick={onUnconfirm}
            title="Unconfirm to make changes"
          >
            Unconfirm
          </button>
        ) : (
          <button 
            className={styles.confirmButton}
            onClick={onConfirm}
            title="Confirm details (Shift+Enter)"
          >
            Confirm Details
          </button>
        )}
        
        <button 
          className={styles.editButton}
          onClick={onEdit}
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
