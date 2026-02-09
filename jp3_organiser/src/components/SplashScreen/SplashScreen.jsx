import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SplashScreen.module.css';
import { invoke } from '@tauri-apps/api/core';

export default function SplashScreen() {
  const navigate = useNavigate();

useEffect(() => {
  const timer = setTimeout(async () => {
    try {
      await invoke("splash_screen");
    } catch (e) {
      console.error(`Failed to finish splash: ${e}`);
    }
  }, SPLASH_DURATION);

  return () => clearTimeout(timer);
}, [navigate]); // Ensure that 'navigate' is correctly defined in your component

  return (
    <div className={styles.splashContainer}>
      <div className={styles.logoWrapper}>
        <img
          src="/jp3_splash.gif"
          alt="JP3 Organiser"
          className={styles.logo}
        />
      </div>
      <p className={styles.tagline}>jp3 organiser</p>
    </div>
  );
}

const SPLASH_DURATION = 2000;
