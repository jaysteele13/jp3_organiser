import React from 'react';
import styles from './LoadingState.module.css';

export default React.memo(function LoadingState({ message = 'Loading...' }) {
  return (
    <div className={styles.container}>
      <div className={styles.loading}>{message}</div>
    </div>
  );
});