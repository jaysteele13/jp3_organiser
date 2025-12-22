import React from 'react';
import Header from '../../components/Header';
import DirectoryConfig from './components/DirectoryConfig';
import UploadFile from './components/UploadFile';
import { useLibraryConfig } from '../../hooks';
import styles from './Upload.module.css';

/**
 * Upload Page
 * 
 * Main page for uploading music files to JP3 Organiser.
 * 
 * Flow:
 * 1. User must first configure the library directory (large card)
 * 2. Once configured, compact card shows in top-right
 * 3. User can then upload audio files
 * 4. (Future) Files will be processed through metadata extraction pipeline
 */
export default function Upload() {
  const { 
    libraryPath, 
    isLoading, 
    error, 
    isConfigured,
    saveLibraryPath, 
    clearLibraryPath 
  } = useLibraryConfig();

  if (isLoading) {
    return (
      <div className={styles.uploadPage}>
        <Header
          title="Upload Music"
          description="Prepare your music for the ESP32"
        />
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.7 }}>
          Loading configuration...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.uploadPage}>
      <Header
        title="Upload Music"
        description="Prepare your music for the ESP32"
      />

      <DirectoryConfig
        libraryPath={libraryPath}
        onSave={saveLibraryPath}
        onClear={clearLibraryPath}
        error={error}
      />

      {isConfigured && (
        <UploadFile libraryPath={libraryPath} />
      )}
    </div>
  );
}
