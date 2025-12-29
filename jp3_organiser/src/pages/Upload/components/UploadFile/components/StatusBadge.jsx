/**
 * StatusBadge Component
 * 
 * Displays a colored badge indicating file status.
 * 
 * Status logic:
 * - Confirmed: User reviewed and approved (takes precedence)
 * - Automated: Has complete metadata from ID3/fingerprint, awaiting review
 * - Incomplete: Missing required fields
 * - Error: Failed to process
 * - Pending: Waiting to be processed
 */

import React from 'react';
import { MetadataStatus } from '../../../../../services';
import styles from '../UploadFile.module.css';

const STATUS_CONFIG = {
  confirmed: { className: styles.statusConfirmed, label: 'Confirmed' },
  automated: { className: styles.statusAutomated, label: 'Automated' },
  [MetadataStatus.INCOMPLETE]: { className: styles.statusIncomplete, label: 'Incomplete' },
  [MetadataStatus.ERROR]: { className: styles.statusError, label: 'Error' },
  [MetadataStatus.PENDING]: { className: styles.statusPending, label: 'Pending' },
};

/**
 * Get the display status based on metadata status and confirmation state.
 * @param {string} metadataStatus - The raw metadata status
 * @param {boolean} isConfirmed - Whether user has confirmed this file
 * @returns {string} The display status key
 */
function getDisplayStatus(metadataStatus, isConfirmed) {
  if (isConfirmed) return 'confirmed';
  if (metadataStatus === MetadataStatus.COMPLETE) return 'automated';
  return metadataStatus;
}

export default function StatusBadge({ status, isConfirmed = false }) {
  const displayStatus = getDisplayStatus(status, isConfirmed);
  const config = STATUS_CONFIG[displayStatus] || STATUS_CONFIG[MetadataStatus.PENDING];
  return <span className={config.className}>{config.label}</span>;
}
