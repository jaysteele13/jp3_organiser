/**
 * ProcessFile Component
 * 
 * Handles file selection and processing workflow.
 * Shows progress during processing and transitions to review
 * once all files are processed.
 * 
 * Files are displayed in sections by status:
 * - Confirmed: User reviewed and approved
 * - Automated: Has metadata from ID3/fingerprint, awaiting review
 * - Incomplete: Missing required fields
 * - Error: Failed to process
 * 
 * @param {Object} props
 * @param {function} props.onProcessingComplete - Called when processing finishes
 * @param {function} props.onStartReview - Called when user wants to start review
 */

import React, { useMemo } from 'react';
import { useFileProcessor } from './hooks';
import { FileStats, StatusBadge } from '../UploadFile/components';
import { MetadataStatus } from '../../../../services';
import styles from './ProcessFile.module.css';

/**
 * Format processing progress for display.
 * @param {Object} progress - { current, total }
 * @returns {string} Formatted progress string
 */
function formatProgress(progress) {
  if (progress.total === 0) return 'Processing...';
  return `Processing ${progress.current}/${progress.total}...`;
}

/**
 * FileSection Component - renders a group of files with a header
 */
function FileSection({ title, files, className }) {
  if (files.length === 0) return null;
  
  return (
    <div className={styles.fileSection}>
      <h4 className={`${styles.sectionTitle} ${className || ''}`}>
        {title} ({files.length})
      </h4>
      <ul className={styles.fileList}>
        {files.map((file) => (
          <li className={styles.fileItem} key={file.trackingId}>
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{file.fileName}</span>
              <span className={styles.fileMeta}>
                {file.metadata?.artist && `${file.metadata.artist}`}
                {file.metadata?.title && ` - ${file.metadata.title}`}
                {file.metadataSource && file.metadataSource !== 'unknown' && (
                  <span className={styles.sourceTag}>
                    {file.metadataSource === 'id3' && ' (ID3)'}
                    {file.metadataSource === 'fingerprint' && ' (Fingerprint)'}
                    {file.metadataSource === 'manual' && ' (Manual)'}
                  </span>
                )}
              </span>
            </div>
            <div className={styles.fileStatus}>
              <StatusBadge status={file.metadataStatus} isConfirmed={file.isConfirmed} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ProcessFile({ onStartReview }) {
  const {
    trackedFiles,
    isProcessing,
    error,
    processingProgress,
    stats,
    isProcessingComplete,
    selectFiles,
    cancelProcessing,
    clearFiles,
  } = useFileProcessor();

  // Group files by display status
  const groupedFiles = useMemo(() => {
    const confirmed = [];
    const automated = [];
    const incomplete = [];
    const errors = [];

    trackedFiles.forEach(file => {
      if (file.isConfirmed) {
        confirmed.push(file);
      } else if (file.metadataStatus === MetadataStatus.COMPLETE) {
        automated.push(file);
      } else if (file.metadataStatus === MetadataStatus.INCOMPLETE) {
        incomplete.push(file);
      } else if (file.metadataStatus === MetadataStatus.ERROR) {
        errors.push(file);
      }
    });

    return { confirmed, automated, incomplete, errors };
  }, [trackedFiles]);

  // Handle file selection
  const handleSelectFiles = async () => {
    await selectFiles();
  };

  // Handle clear/cancel
  const handleClearOrCancel = () => {
    if (isProcessing) {
      cancelProcessing();
    }
    clearFiles();
  };

  // Handle start review
  const handleStartReview = () => {
    if (onStartReview && trackedFiles.length > 0) {
      onStartReview(trackedFiles);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>Select Audio Files</h3>
        <p className={styles.hint}>
          Files will be scanned for metadata using ID3 tags and audio fingerprinting.
        </p>
      </div>

      {/* Select/Clear buttons */}
      <div className={styles.actions}>
        <button 
          className={styles.selectButton} 
          onClick={handleSelectFiles}
          disabled={isProcessing}
        >
          {isProcessing ? formatProgress(processingProgress) : 'Select Audio Files'}
        </button>
        
        {(trackedFiles.length > 0 || isProcessing) && (
          <button 
            className={styles.clearButton}
            onClick={handleClearOrCancel}
          >
            {isProcessing ? 'Cancel' : 'Clear'}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && <div className={styles.error}>{error}</div>}

      {/* File list section */}
      {trackedFiles.length > 0 && (
        <div className={styles.fileListContainer}>
          <FileStats stats={stats} isProcessing={isProcessing} />

          {/* Processing complete - show review button */}
          {isProcessingComplete && (
            <div className={styles.reviewPrompt}>
              <p className={styles.reviewMessage}>
                Processing complete. Review and confirm your files before adding to the library.
              </p>
              <button 
                className={styles.reviewButton}
                onClick={handleStartReview}
              >
                Review {stats.total} File(s)
              </button>
            </div>
          )}

          {/* Grouped file sections */}
          <div className={styles.fileSections}>
            <FileSection 
              title="Confirmed" 
              files={groupedFiles.confirmed} 
              className={styles.sectionConfirmed}
            />
            <FileSection 
              title="Automated" 
              files={groupedFiles.automated} 
              className={styles.sectionAutomated}
            />
            <FileSection 
              title="Incomplete" 
              files={groupedFiles.incomplete} 
              className={styles.sectionIncomplete}
            />
            <FileSection 
              title="Errors" 
              files={groupedFiles.errors} 
              className={styles.sectionError}
            />
          </div>
        </div>
      )}
    </div>
  );
}
