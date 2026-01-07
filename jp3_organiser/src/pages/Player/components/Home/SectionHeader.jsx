/**
 * SectionHeader Component
 * 
 * Reusable section header with title and optional "See all" action button.
 * Used in HomeView to introduce each library section.
 * 
 * Props:
 * - title: string - section title
 * - count: number (optional) - item count to display
 * - onSeeAll: function (optional) - callback when "See all" is clicked
 * - showSeeAll: boolean (default true) - whether to show the "See all" button
 */

import React from 'react';
import styles from './SectionHeader.module.css';

export default function SectionHeader({ 
  title, 
  count, 
  onSeeAll, 
  showSeeAll = true 
}) {
  return (
    <div className={styles.header}>
      <div className={styles.titleGroup}>
        <h2 className={styles.title}>{title}</h2>
        {count !== undefined && (
          <span className={styles.count}>({count})</span>
        )}
      </div>
      {showSeeAll && onSeeAll && (
        <button className={styles.seeAllBtn} onClick={onSeeAll}>
          See all
        </button>
      )}
    </div>
  );
}
