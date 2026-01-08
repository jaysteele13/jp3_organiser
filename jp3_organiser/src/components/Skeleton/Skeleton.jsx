/**
 * Skeleton Component
 * 
 * Animated loading placeholder for content that's being loaded.
 * Provides a pulse animation to indicate loading state.
 * 
 * Props:
 * - variant: 'text' | 'card' | 'songRow' | 'button' | 'circle'
 * - width: Custom width (default varies by variant)
 * - height: Custom height (default varies by variant)
 * - count: Number of skeleton items to render (for lists)
 */

import React from 'react';
import styles from './Skeleton.module.css';

export default function Skeleton({ 
  variant = 'text', 
  width, 
  height,
  count = 1,
}) {
  const skeletons = [];
  
  for (let i = 0; i < count; i++) {
    skeletons.push(
      <div 
        key={i}
        className={`${styles.skeleton} ${styles[variant]}`}
        style={{ 
          width: width || undefined, 
          height: height || undefined 
        }}
      />
    );
  }
  
  return count === 1 ? skeletons[0] : <div className={styles.container}>{skeletons}</div>;
}

/**
 * SkeletonSongRow - Pre-styled skeleton for song rows in lists
 */
export function SkeletonSongRow() {
  return (
    <div className={styles.songRow}>
      <div className={`${styles.skeleton} ${styles.songTitle}`} />
      <div className={`${styles.skeleton} ${styles.songSubtitle}`} />
    </div>
  );
}

/**
 * SkeletonSongList - Multiple song row skeletons
 */
export function SkeletonSongList({ count = 5 }) {
  return (
    <div className={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonSongRow key={i} />
      ))}
    </div>
  );
}

/**
 * SkeletonCard - Pre-styled skeleton for card grids
 */
export function SkeletonCard() {
  return (
    <div className={styles.card}>
      <div className={`${styles.skeleton} ${styles.cardTitle}`} />
      <div className={`${styles.skeleton} ${styles.cardSubtitle}`} />
      <div className={`${styles.skeleton} ${styles.cardMeta}`} />
    </div>
  );
}

/**
 * SkeletonCardGrid - Multiple card skeletons
 */
export function SkeletonCardGrid({ count = 6 }) {
  return (
    <div className={styles.cardGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
