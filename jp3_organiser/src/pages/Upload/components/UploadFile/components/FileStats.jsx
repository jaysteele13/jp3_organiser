/**
 * FileStats Component
 * 
 * Displays a summary bar with file counts by status.
 */

import React from 'react';
import styles from '../UploadFile.module.css';

export default function FileStats({ stats }) {
  return (
    <div className={styles.statsBar}>
      <span className={styles.statItem}>
        {stats.total} file(s)
      </span>
      {stats.complete > 0 && (
        <span className={styles.statComplete}>
          {stats.complete} complete
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
