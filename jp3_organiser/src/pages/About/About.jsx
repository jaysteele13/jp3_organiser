import React, { useEffect } from 'react';
import Header from '../../components/Header';
import styles from './About.module.css';
import AboutCard from './components';
import { clearMbids } from '../../services';

export default function About() {



  return (
    <div className={styles.AboutAll}>
      <Header
        title="JP3 Organiser"
        description="Turn your SD card into an MP3 Haven. Think Local Spotify — but Irish, offline, and running on an ESP32."
      />

      <AboutCard
        description="The point of this application is to format your **MicroSD** in such a way that the **ESP32** can play music from it easily. Without RAM issues and without
        loading in 1000 duplicates... and ensuring the song data is actually accurate. But as this is built using Tauri with a Rust backend, I envision this 
        software to be."/>

      <AboutCard
        description="Act as your lil Pocket USB Drive, JP3-ify baby!"/>

      <section className={styles.Flow}>
        SD Card → JP3 Organiser → library.bin → ESP32 → 🎵
      </section>
    </div>
  );
}
