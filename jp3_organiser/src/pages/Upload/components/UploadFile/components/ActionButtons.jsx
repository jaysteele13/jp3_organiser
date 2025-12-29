/**
 * ActionButtons Component
 * 
 * Primary action buttons for Add to Library and Review incomplete files.
 */

import React from 'react';
import styles from '../UploadFile.module.css';

export default function ActionButtons({
  stats,
  allFilesReady,
  isReviewMode,
  editingFileId,
  isSaving,
  isProcessing,
  onReview,
  onAddToLibrary,
}) {
  // Don't show action buttons while still processing
  if (isProcessing) {
    return null;
  }

  const showReviewButton = stats.incomplete > 0 && !isReviewMode && !editingFileId;
  const showPrimaryAddButton = allFilesReady;
  const showSecondaryAddButton = !allFilesReady && stats.complete > 0 && !isReviewMode && !editingFileId;

  return (
    <>
      {/* Review incomplete files button */}
      {showReviewButton && (
        <button 
          className={styles.reviewButton}
          onClick={onReview}
        >
          Review {stats.incomplete} incomplete file(s)
        </button>
      )}

      {/* All files ready message and Add to Library button */}
      {showPrimaryAddButton && (
        <div className={styles.readyContainer}>
          <div className={styles.readyMessage}>
            All files have complete metadata and are ready to be added to the library.
          </div>
          <button 
            className={styles.addToLibraryButton}
            onClick={onAddToLibrary}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : `Add ${stats.complete} file(s) to Library`}
          </button>
        </div>
      )}

      {/* Some files ready - show Add to Library option */}
      {showSecondaryAddButton && (
        <button 
          className={styles.addToLibraryButtonSecondary}
          onClick={onAddToLibrary}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : `Add ${stats.complete} complete file(s) to Library`}
        </button>
      )}
    </>
  );
}
