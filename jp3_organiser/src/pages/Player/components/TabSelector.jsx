/**
 * TabSelector Component
 * 
 * Tab buttons for switching between Songs, Albums, Artists, and Playlists views.
 */

import React from 'react';
import { TABS } from '../../../utils/enums';
import styles from './TabSelector.module.css';

const TAB_CONFIG = [
  { id: TABS.SONGS, label: 'Songs' },
  { id: TABS.ALBUMS, label: 'Albums' },
  { id: TABS.ARTISTS, label: 'Artists' },
  { id: TABS.PLAYLISTS, label: 'Playlists' },
];

export default function TabSelector({ activeTab, onTabChange }) {
  return (
    <div className={styles.tabs}>
      {TAB_CONFIG.map(({ id, label }) => (
        <button
          key={id}
          className={`${styles.tab} ${activeTab === id ? styles.active : ''}`}
          onClick={() => onTabChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
