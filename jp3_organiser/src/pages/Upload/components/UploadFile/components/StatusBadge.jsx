/**
 * StatusBadge Component
 * 
 * Displays a colored badge indicating metadata status.
 */

import React from 'react';
import { MetadataStatus } from '../../../../../services';
import styles from '../UploadFile.module.css';

const STATUS_CONFIG = {
  [MetadataStatus.COMPLETE]: { className: styles.statusComplete, label: 'Complete' },
  [MetadataStatus.INCOMPLETE]: { className: styles.statusIncomplete, label: 'Incomplete' },
  [MetadataStatus.ERROR]: { className: styles.statusError, label: 'Error' },
  [MetadataStatus.PENDING]: { className: styles.statusPending, label: 'Pending' },
};

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[MetadataStatus.PENDING];
  return <span className={config.className}>{config.label}</span>;
}
