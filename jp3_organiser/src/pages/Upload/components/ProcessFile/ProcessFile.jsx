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
 * @param {function} props.onStartReview - Called when user wants to start review
 */

import React, { useMemo } from 'react';
import { useFileProcessor } from './hooks';
import { FileStats, StatusBadge } from '../UploadFile/components';
import { MetadataStatus } from '../../../../services';
import { useUploadCache } from '../../../../hooks';
import { UPLOAD_MODE } from '../../../../utils';
import styles from './ProcessFile.module.css';
import ModeImage from '../UploadModeSelector/ModeImage';
import { REVIEW_IMAGES } from '../../../../utils/enums';

import { useState } from 'react';

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
      <h3 className={`${styles.sectionTitle} ${className || ''}`}>
        {title} {files.length}
      </h3>
      <ul className={styles.fileList}>
        {files.map((file, index) => (
          <li
            className={`${styles.fileItem} ${index === files.length-1 ? styles.allowBottomBorder : ''}`}
            key={file.trackingId}
          >
            <div className={styles.fileInfo}>
              <span className={styles.fileName}>{file.fileName}</span>
              <span className={styles.fileMeta}>
                {file.metadata?.artist && `${file.metadata.artist}`}
                {file.metadata?.title && `- ${file.metadata.title}`}
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
  const cache = useUploadCache();
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

  // Get upload mode and context from cache
  const { uploadMode, uploadContext } = cache;

  const [hovered, setHovered] = useState(null);

  // Format context for display
  const contextLabel = useMemo(() => {
    if (uploadMode === UPLOAD_MODE.ALBUM && uploadContext.album) {
      return `${uploadContext.album} by ${uploadContext.artist}${uploadContext.year ? ` (${uploadContext.year})` : ''}`;
    }
    if (uploadMode === UPLOAD_MODE.ARTIST && uploadContext.artist) {
      return uploadContext.artist;
    }
    if (uploadMode === UPLOAD_MODE.PLAYLIST && uploadContext.playlist) {
      return uploadContext.playlist;
    }
    return null;
  }, [uploadMode, uploadContext]);

  // Mode label for display
  const modeLabel = useMemo(() => {
    switch (uploadMode) {
      case UPLOAD_MODE.ALBUM: return 'Album Mode';
      case UPLOAD_MODE.ARTIST: return 'Artist Mode';
      case UPLOAD_MODE.PLAYLIST: return 'Playlist Mode';
      default: return null;
    }
  }, [uploadMode]);

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

  // Determine what state we're in -> to test UI conditions
  const hasFiles = trackedFiles.length > 0;
  const showSelectButton = !hasFiles && !isProcessing;
  const showProcessingButton = isProcessing;
  const showReviewPrompt = hasFiles && isProcessingComplete;

  return (
    <div className={styles.container}>
      {/* Mode/Context badge - shown when in Album or Artist mode */}
      {modeLabel && (
        <div className={styles.contextBadge}>
          <span className={styles.modeLabel}>{modeLabel}</span>
          {contextLabel && (
            <span className={styles.contextLabel}>{contextLabel}</span>
          )}
        </div>
      )}

      {/* Header - changes based on state */}
      <div className={styles.header}>
        <h3 className={styles.title}>
          {!hasFiles && !isProcessing && 'Select Audio Files'}
          {isProcessing && 'Processing Files'}
          {hasFiles && !isProcessing && 'Review Files'}
        </h3>
        <p className={styles.hint}>
          {!hasFiles && !isProcessing && 'Files will be scanned for metadata using ID3 tags and audio fingerprinting.'}
          {isProcessing && 'Extracting metadata from your audio files...'}
          {hasFiles && !isProcessing && 'Review and confirm metadata before adding to your library.'}
        </p>
      </div>

      {/* Action buttons */}
      <div className={styles.actions}>
        {/* Select button - only when no files */}
        {showSelectButton && (
          <button 
            className={styles.selectButton} 
            onClick={handleSelectFiles}
          >
            Select Audio Files
          </button>
        )}

        {/* Processing indicator */}
        {showProcessingButton && (
          <button 
            className={styles.selectButton} 
            disabled
          >
            {formatProgress(processingProgress)}
          </button>
        )}
{/* Review {stats.total} File(s) */}

        <div className={styles.reviewLayout}>
          {/* Review button - when files ready */}
        {showReviewPrompt && (
          
        <button 
            className={styles.reviewEyesButton}
            onClick={handleStartReview}
            onMouseEnter={() => setHovered('review')}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered('review')}
            onBlur={() => setHovered(null)}
            onTouchStart={() => setHovered(h => (h === 'review' ? null : 'review'))}
          >
             <ModeImage still={REVIEW_IMAGES.REVIEW.still} gif={REVIEW_IMAGES.REVIEW.gif} alt={"Review Files"} className={styles.modeImage} playing={hovered === 'review'} />
           
          </button>
          
        )}
        
        {/* Clear/Cancel button */}
        {(hasFiles || isProcessing) && (
          <div className={styles.reviewSecondRow}>
          <span 
            className={styles.noOfFiles}
            aria-label={`Number of files: ${stats.total}`}
            title={`Number of files: ${stats.total}`}
          >
            {stats.total}
          </span>

          <button 
            className={styles.clearButton}
            onClick={handleClearOrCancel}
          >
            {isProcessing ? 'Cancel' : 'Clear'}
          </button>
          </div>
        )}
        </div>
      </div>

      {/* Error message */}
      {error && <div className={styles.error}>{error}</div>}

      {/* File list section */}
      {hasFiles && (
        <div className={styles.fileListContainer}>
 

          {/* Grouped file sections */}
          <div className={styles.fileSections}>
            <FileSection 
              title="Confirmed" 
              files={groupedFiles.confirmed} 
              className={styles.sectionConfirmed}
            />
            <FileSection 
              title="" 
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
