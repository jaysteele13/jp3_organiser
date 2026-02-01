/**
 * NavigationControls Component
 * 
 * Navigation and action buttons for the review screen.
 * Includes previous/next, confirm/unconfirm, and edit buttons.
 * 
 * @param {Object} props
 * @param {Object} props.navigation - Navigation controller object from useReviewNavigation hook
 */

import React from 'react';
import styles from '../ReviewScreen.module.css';

export default function NavigationControls({ navigation }) {
  const {
    currentPosition,
    totalFiles,
    confirmedCount,
    canGoPrevious,
    canGoNext,
    currentFile,
    validationError,
    goPrevious,
    goNext,
    confirmCurrent,
    unconfirmCurrent,
    removeCurrent,
    enterEditMode,
  } = navigation;

  const isConfirmed = currentFile?.isConfirmed;

  return (
    <div className={styles.navigationControls}>
      {/* Progress indicator */}
      <div className={styles.progressIndicator}>
        <span className={styles.progressText}>
          File {currentPosition} of {totalFiles}
        </span>
        <span className={styles.confirmProgress}>
          (<b>{confirmedCount}</b> of {totalFiles} confirmed)
        </span>

      </div>

      {/* Navigation arrows */}
      <div className={styles.navArrows}>
        <button 
          className={styles.navButton}
          onClick={goPrevious}
          disabled={!canGoPrevious}
          title="Previous file"
        >
          &larr; Previous
        </button>
        <button 
          className={styles.navButton}
          onClick={goNext}
          disabled={!canGoNext}
          title="Next file"
        >
          Next &rarr;
        </button>
      </div>

      {/* Action buttons */}
      <div className={styles.actionButtons}>
        {/* Show confirm/unconfirm based on current file state */}
        {isConfirmed ? (
          <button 
            className={styles.unconfirmButton}
            onClick={unconfirmCurrent}
            title="Unconfirm to make changes"
          >
            Unconfirm
          </button>
        ) : (
          <button 
            className={styles.confirmButton}
            onClick={confirmCurrent}
            title="Confirm details (Shift+Enter)"
          >
            Confirm Details
          </button>
        )}
        
        <button 
          className={styles.editButton}
          onClick={enterEditMode}
        >
          Edit
        </button>
        
        <button 
          className={styles.removeButton}
          onClick={removeCurrent}
          title="Remove from list"
        >
          Remove
        </button>
      </div>

      {/* Validation error */}
      {validationError && (
        <div className={styles.validationError}>
          {validationError}
        </div>
      )}
    </div>
  );
}
