import React from 'react';
import AboutHeader from './Components/AboutHeader/AboutHeader.jsx';
import styles from './About.module.css';

export default function About() {
  return (
    <div className={styles.AboutAll}>
      <AboutHeader
        title="JP3 Organiser"
        description="This application will transform your SD card into an MP3 Haven. You will be able to save your files to your storage device, and then this software will parse them and turn them into a local Spotify but... Irish."
      />

      <p>
        The point of this application is to format your <b>MicroSD</b> in such a way that the <b>ESP32</b> can play music from it easily. Without RAM issues and without
        loading in 1000 duplicates... and ensuring the song data is actually accurate. But as this is built using Tauri with a Rust backend, I envision this 
        software to be:
      </p>

      <ul>
        <li>Lightweight</li>
        <li>Look good (React init)</li>
        <li>Have silly AI client-side features</li>
        <li>Act as your lil Pocket USB Drive, Irish JP3-ify baby</li>
      </ul>
    </div>
  );
}
