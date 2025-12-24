/**
 * ReviewPanel Component
 * 
 * Wrapper for reviewing incomplete files with progress header.
 */

import React from 'react';
import MetadataForm from '../../MetadataForm';
import styles from '../UploadFile.module.css';

export default function ReviewPanel({ 
  currentFile, 
  currentIndex, 
  totalFiles,
  onSave,
  onSkip,
  onExit 
}) {
  if (!currentFile) return null;

  return (
    <div className={styles.reviewContainer}>
      <div className={styles.reviewHeader}>
        <span className={styles.reviewProgress}>
          File {currentIndex + 1} of {totalFiles}
        </span>
        <button 
          className={styles.reviewCancelButton}
          onClick={onExit}
        >
          Exit Review
        </button>
      </div>
      <MetadataForm
        file={currentFile}
        onSave={onSave}
        onSkip={onSkip}
      />
    </div>
  );
}
