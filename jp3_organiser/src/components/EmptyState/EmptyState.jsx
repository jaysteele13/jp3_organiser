import React from 'react';
import styles from './EmptyState.module.css';

export default React.memo(function EmptyState({ title, message }) {
  return (
    <div className={styles.emptyState}>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  );
});