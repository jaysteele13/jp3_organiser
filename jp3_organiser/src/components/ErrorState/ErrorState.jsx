import React from 'react';
import styles from './ErrorState.module.css';

export default React.memo(function ErrorState({ error }) {
  return (
    (error  &&
    <div className={styles.error}>
      {error}
    </div>
  ));
});