/**
 * UploadFile Component
 * 
 * Orchestrates audio file upload, metadata review, and library saving.
 * 
 * Flow:
 * 1. User selects files -> assigned trackingId
 * 2. Extract ID3 metadata -> mark as Complete or Incomplete
 * 3. Review/edit incomplete files manually
 * 4. Save complete files to library
 * 
 * @param {Object} props
 * @param {string} props.libraryPath - The configured library directory path
 */

import React, { useEffect } from 'react';
import { useFileUpload, useReviewMode } from './hooks';
import { FileStats, FileList, ReviewPanel, ActionButtons } from './components';
import MetadataForm from '../MetadataForm';
import styles from './UploadFile.module.css';

export default function UploadFile({ libraryPath }) {
  // File management state and actions
  const {
    trackedFiles,
    isProcessing,
    isSaving,
    error,
    successMessage,
    stats,
    incompleteFiles,
    allFilesReady,
    selectFiles,
    clearFiles,
    updateFileMetadata,
    removeFile,
    saveToLibrary,
  } = useFileUpload(libraryPath);

  // Review mode state and actions
  const review = useReviewMode(incompleteFiles, {
    onSaveMetadata: updateFileMetadata,
    onRemoveFile: removeFile,
  });

  // Reset review mode when files are cleared
  useEffect(() => {
    if (trackedFiles.length === 0) {
      review.reset();
    }
  }, [trackedFiles.length, review.reset]);

  // Handle file selection (resets review mode)
  const handleSelectFiles = async () => {
    review.reset();
    await selectFiles();
  };

  // Handle clear (resets everything)
  const handleClear = () => {
    review.reset();
    clearFiles();
  };

  return (
    <div className={styles.uploadContainer}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>Select Audio Files</h3>
        <p className={styles.hint}>
          Files will be scanned for ID3 metadata. Complete files have artist, album, and title.
        </p>
      </div>

      {/* Select/Clear buttons */}
      <div className={styles.actions}>
        <button 
          className={styles.selectButton} 
          onClick={handleSelectFiles}
          disabled={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Select Audio Files'}
        </button>
        
        {trackedFiles.length > 0 && (
          <button 
            className={styles.clearButton}
            onClick={handleClear}
            disabled={isProcessing}
          >
            Clear
          </button>
        )}
      </div>

      {/* Error/Success messages */}
      {error && <div className={styles.error}>{error}</div>}
      {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

      {/* File list section */}
      {trackedFiles.length > 0 && (
        <div className={styles.fileListContainer}>
          <FileStats stats={stats} />

          <ActionButtons
            stats={stats}
            allFilesReady={allFilesReady}
            isReviewMode={review.isReviewMode}
            editingFileId={review.editingFileId}
            isSaving={isSaving}
            onReview={review.startReview}
            onAddToLibrary={saveToLibrary}
          />

          {/* Review mode panel */}
          {review.isReviewMode && review.currentReviewFile && (
            <ReviewPanel
              currentFile={review.currentReviewFile}
              currentIndex={review.currentIndex}
              totalFiles={review.totalIncomplete}
              onSave={review.handleSave}
              onSkip={review.handleSkip}
              onExit={review.exitReview}
            />
          )}

          {/* Single file edit form */}
          {review.editingFile && !review.isReviewMode && (
            <MetadataForm
              file={review.editingFile}
              onSave={review.handleSave}
              onCancel={review.cancelEdit}
              onSkip={review.handleSkip}
            />
          )}

          {/* File list */}
          <FileList
            files={trackedFiles}
            editingFileId={review.editingFileId}
            isReviewMode={review.isReviewMode}
            onEdit={review.editFile}
          />
        </div>
      )}
    </div>
  );
}
