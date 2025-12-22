import React from 'react';
import Header from '../../components/Header';
import styles from './About.module.css';

export default function About() {
  return (
    <div className={styles.AboutAll}>
      <Header
        title="JP3 Organiser"
        description="Turn your SD card into an MP3 Haven. Think Local Spotify — but Irish, offline, and running on an ESP32."
      />

      <section className={styles.Section}>
        <p className={styles.fadeIn}>
          The point of this application is to format your <b>MicroSD</b> in such a way that the <b>ESP32</b> can play music from it easily. Without RAM issues and without
        loading in 1000 duplicates... and ensuring the song data is actually accurate. But as this is built using Tauri with a Rust backend, I envision this 
        software to be
        </p>
      </section>

       <section className={styles.Section}>
        <p className={styles.fadeIn}>
          Act as your lil Pocket USB Drive, Irish JP3-ify baby
        </p>
      </section>

      <section className={styles.Flow}>
        SD Card → JP3 Organiser → library.bin → ESP32 → 🎵
      </section>
    </div>
  );
}
