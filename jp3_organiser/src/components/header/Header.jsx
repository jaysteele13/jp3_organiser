import React from 'react';
import styles from './Header.module.css';

export default function Header({ title, description }) {
  return (
    <>
      <h1 className={styles.AboutHeader}>{title}</h1>
      <p className={styles.AboutDescription}>{description}</p>
    </>
  );
}
