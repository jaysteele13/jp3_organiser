/**
 * MetadataDisplay Component
 * 
 * Displays the metadata for a song with source indicator.
 * 
 * Status labels:
 * - Confirmed: User has reviewed and approved
 * - Automated: Has complete metadata from ID3/fingerprint
 * - Incomplete: Missing required fields
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
    case 'fingerprint':
      return 'Audio Fingerprint';
    case 'manual':
      return 'Manual Entry';
    default:
      return 'Unknown';
  }
}

/**
 * Get display status label based on file state.
 * @param {string} metadataStatus - The raw metadata status
 * @param {boolean} isConfirmed - Whether user has confirmed this file
 * @returns {Object} { label, className }
 */
function getStatusDisplay(metadataStatus, isConfirmed) {
  if (isConfirmed) {
    return { label: 'Confirmed', className: 'statusconfirmed' };
  }
  if (metadataStatus === 'complete') {
    return { label: 'Automated', className: 'statusautomated' };
  }
  return { label: 'Incomplete', className: 'statusincomplete' };
}

export default function MetadataDisplay({ file }) {
  if (!file) return null;

  const { metadata, metadataSource, metadataStatus, isConfirmed } = file;
  const isAutomated = metadataSource === 'id3' || metadataSource === 'fingerprint';
  const statusDisplay = getStatusDisplay(metadataStatus, isConfirmed);

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
      </div>

      {/* Status indicator */}
      {statusDisplay.label == 'Confirmed' && (

      
      <div className={styles.statusRow}>
        <span className={`${styles.statusBadge} ${styles[statusDisplay.className]}`}>
          {statusDisplay.label}
        </span>
      </div>
      )}
    </div>
  );
}
