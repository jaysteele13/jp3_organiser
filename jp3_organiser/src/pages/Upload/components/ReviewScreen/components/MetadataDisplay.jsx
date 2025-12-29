/**
 * MetadataDisplay Component
 * 
 * Displays the metadata for a song with source indicator.
 */

import React from 'react';
import styles from '../ReviewScreen.module.css';

/**
 * Get human-readable label for metadata source.
 * @param {string} source - Metadata source value
 * @returns {string} Display label
 */
function getSourceLabel(source) {
  switch (source) {
    case 'id3':
      return 'ID3 Tags';
    case 'acoustid':
      return 'AcoustID';
    case 'manual':
      return 'Manual Entry';
    default:
      return 'Unknown';
  }
}

export default function MetadataDisplay({ file }) {
  if (!file) return null;

  const { metadata, metadataSource, metadataStatus } = file;
  const isAutomated = metadataSource === 'id3' || metadataSource === 'acoustid';

  return (
    <div className={styles.metadataDisplay}>
      {/* Automated indicator */}
      <div className={styles.sourceIndicator}>
        <span className={`${styles.sourceTag} ${isAutomated ? styles.sourceAutomated : styles.sourceManual}`}>
          {isAutomated ? 'Automated' : 'Manual'}
        </span>
        <span className={styles.sourceDetail}>
          via {getSourceLabel(metadataSource)}
        </span>
      </div>

      {/* Metadata fields */}
      <div className={styles.metadataFields}>
        <div className={styles.metadataField}>
          <label className={styles.fieldLabel}>Title</label>
          <span className={`${styles.fieldValue} ${!metadata?.title ? styles.fieldMissing : ''}`}>
            {metadata?.title || 'Not available'}
          </span>
        </div>

        <div className={styles.metadataField}>
          <label className={styles.fieldLabel}>Artist</label>
          <span className={`${styles.fieldValue} ${!metadata?.artist ? styles.fieldMissing : ''}`}>
            {metadata?.artist || 'Not available'}
          </span>
        </div>

        <div className={styles.metadataField}>
          <label className={styles.fieldLabel}>Album</label>
          <span className={`${styles.fieldValue} ${!metadata?.album ? styles.fieldMissing : ''}`}>
            {metadata?.album || 'Not available'}
          </span>
        </div>

        {metadata?.year && (
          <div className={styles.metadataField}>
            <label className={styles.fieldLabel}>Year</label>
            <span className={styles.fieldValue}>{metadata.year}</span>
          </div>
        )}

        {metadata?.trackNumber && (
          <div className={styles.metadataField}>
            <label className={styles.fieldLabel}>Track</label>
            <span className={styles.fieldValue}>{metadata.trackNumber}</span>
          </div>
        )}
      </div>

      {/* Status indicator */}
      <div className={styles.statusRow}>
        <span className={`${styles.statusBadge} ${styles[`status${metadataStatus}`]}`}>
          {metadataStatus === 'complete' ? 'Complete' : 'Incomplete'}
        </span>
      </div>
    </div>
  );
}
