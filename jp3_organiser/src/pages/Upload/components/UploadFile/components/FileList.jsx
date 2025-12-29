/**
 * FileList Component
 * 
 * Displays a scrollable list of tracked audio files with status and edit actions.
 */

import React from 'react';
import { MetadataStatus } from '../../../../../services';
import { formatFileSize } from '../../../../../utils';
import StatusBadge from './StatusBadge';
import styles from '../UploadFile.module.css';

export default function FileList({ 
  files, 
  editingFileId, 
  isReviewMode,
  onEdit 
}) {
  return (
    <ul className={styles.fileList}>
      {files.map((file) => (
        <li 
          className={`${styles.fileItem} ${file.trackingId === editingFileId ? styles.fileItemActive : ''}`} 
          key={file.trackingId}
        >
          <div className={styles.fileInfo}>
            <span className={styles.fileName}>{file.fileName}</span>
            <span className={styles.fileMeta}>
              {formatFileSize(file.fileSize)}
              {file.metadata?.artist && ` • ${file.metadata.artist}`}
              {file.metadata?.title && ` - ${file.metadata.title}`}
            </span>
          </div>
          <div className={styles.fileActions}>
            {file.metadataStatus === MetadataStatus.INCOMPLETE && !isReviewMode && (
              <button 
                className={styles.editButton}
                onClick={() => onEdit(file.trackingId)}
              >
                Edit
              </button>
            )}
            <div className={styles.fileStatus}>
              <StatusBadge status={file.metadataStatus} isConfirmed={file.isConfirmed} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
