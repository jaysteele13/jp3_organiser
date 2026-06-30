import React from 'react';
import styles from './QueueDrawer.module.css';

export default function DraggableHandle({ isDragging = false }) {
  return (
    <span
      className={styles.dragHandle}
      role="button"
      aria-label="Drag to reorder"
      aria-grabbed={isDragging}
      tabIndex={0}
    >
      ☰
    </span>
  );
}
