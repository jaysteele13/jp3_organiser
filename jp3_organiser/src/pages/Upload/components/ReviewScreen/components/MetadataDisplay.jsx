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

  const { metadata, metadataStatus, isConfirmed } = file;
  const statusDisplay = getStatusDisplay(metadataStatus, isConfirmed);

  return (
    <div className={styles.metadataDisplay}>
    

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

    
    </div>
  );
}
