/**
 * FileStats Component
 * 
 * Displays a summary bar with file counts by status.
 * 
 * Categories:
 * - Confirmed: User reviewed and approved
 * - Automated: Has metadata from ID3/fingerprint, awaiting review
 * - Incomplete: Missing required fields
 * - Error: Failed to process
 */

import React from 'react';
import styles from '../UploadFile.module.css';

export default function FileStats({ stats }) {
  return (
    <div className={styles.statsBar}>
      <span className={styles.statItem}>
        {stats.total} file(s)
      </span>
      {stats.confirmed > 0 && (
        <span className={styles.statConfirmed}>
          {stats.confirmed} confirmed
        </span>
      )}
      {stats.automated > 0 && (
        <span className={styles.statAutomated}>
          {stats.automated} automated
        </span>
      )}
      {stats.incomplete > 0 && (
        <span className={styles.statIncomplete}>
          {stats.incomplete} incomplete
        </span>
      )}
      {stats.error > 0 && (
        <span className={styles.statError}>
          {stats.error} error(s)
        </span>
      )}
    </div>
  );
}
