import React from 'react';
import styles from './AboutHeader.module.css';

export default function AboutHeader({ title, description }) {
  return (
    <>
      <h1 className={styles.AboutHeader}>{title}</h1>
      <p className={styles.AboutDescription}>{description}</p>
    </>
  );
}
