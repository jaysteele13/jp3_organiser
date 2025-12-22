/**
 * DirectoryConfig Component
 * 
 * Allows users to select and configure the directory where JP3 Organiser
 * will save their music library files. This is a prerequisite step before
 * uploading any music files.
 * 
 * Display modes:
 * - Large card: Shown when no library path is configured (initial setup)
 * - Compact card: Shown in top-right when path is configured (hover for actions)
 * 
 * The selected directory is persisted locally and will be used for:
 * - /jp3/music/     - Audio files organized in numbered folders
 * - /jp3/metadata/  - Binary metadata files (library.bin)
 * - /jp3/playlists/ - Playlist data
 */

import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import styles from './DirectoryConfig.module.css';

export default function DirectoryConfig({ 
  libraryPath, 
  onSave, 
  onClear,
  error: externalError 
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  const error = externalError || localError;

  const selectDirectory = async () => {
    try {
      setLocalError(null);
      
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Library Directory',
      });

      if (!selected) return; // User cancelled

      setIsSaving(true);
      const success = await onSave(selected);
      
      if (!success) {
        setLocalError('Failed to save directory. Please try again.');
      }
    } catch (err) {
      setLocalError(err.toString());
      console.error('Failed to select directory:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    try {
      setLocalError(null);
      await onClear();
    } catch (err) {
      setLocalError(err.toString());
    }
  };

  // Extract just the folder name for display
  const getFolderName = (path) => {
    if (!path) return '';
    return path.split(/[/\\]/).pop() || path;
  };

  // Compact card for configured state (top-right, hover for actions)
  if (libraryPath) {
    return (
      <div className={styles.compactContainer}>
        <div className={styles.compactCard}>
          <div className={styles.compactContent}>
            <span className={styles.compactLabel}>Library:</span>
            <span className={styles.compactValue} title={libraryPath}>
              {getFolderName(libraryPath)}
            </span>
            <span className={styles.compactPath}>{libraryPath}</span>
          </div>
          
          <div className={styles.compactActions}>
            <button 
              className={styles.compactButton}
              onClick={selectDirectory}
              disabled={isSaving}
              title="Change location"
            >
              {isSaving ? '...' : 'Change'}
            </button>
            <button 
              className={styles.compactButtonClear}
              onClick={handleClear}
              disabled={isSaving}
              title="Clear location"
            >
              Clear
            </button>
          </div>
        </div>
        
        {error && (
          <div className={styles.compactError}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // Large card for unconfigured state (initial setup)
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h3 className={styles.title}>Library Location</h3>
        
        <p className={styles.description}>
          Choose where JP3 Organiser will save your music library. 
          This folder will contain your organized music files, metadata, and playlists.
        </p>

        <div className={styles.unconfigured}>
          <button 
            className={styles.selectButton}
            onClick={selectDirectory}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Select Directory'}
          </button>
        </div>

        {error && (
          <div className={styles.error}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
