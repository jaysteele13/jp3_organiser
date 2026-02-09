import React from 'react';
import Header from '../../components/Header';
import DirectoryConfig from './components/DirectoryConfig';
import UploadFile from './components/UploadFile';
import { useLibraryConfig, LibraryProvider } from '../../hooks';
import styles from './Upload.module.css';

/**
 * Upload Page
 * 
 * Main page for uploading music files to JP3 Organiser.
 * 
 * Flow:
 * 1. User must first configure the library directory (large card)
 * 2. Directory is auto-initialized with jp3/music/, jp3/metadata/, jp3/playlists/
 * 3. Once configured, compact card shows in top-right
 * 4. User can then upload audio files
 * 5. (Future) Files will be processed through metadata extraction pipeline
 * 
 * The LibraryProvider wraps UploadFile to provide library data via context,
 * eliminating prop drilling through the component tree.
 */
export default function Upload() {
  const { 
    libraryPath,
    libraryInfo,
    isLoading,
    isInitializing,
    error, 
    isConfigured,
    isInitialized,
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
    <div className={`${styles.uploadPage} ${styles.fadeIn}`}>
      <Header
        title="Upload Music"
        description="Prepare your music for the ESP32"
      />

      <DirectoryConfig
        libraryPath={libraryPath}
        libraryInfo={libraryInfo}
        isInitializing={isInitializing}
        onSave={saveLibraryPath}
        onClear={clearLibraryPath}
        error={error}
      />

      {isConfigured && isInitialized && (
        <LibraryProvider libraryPath={libraryPath}>
          <UploadFile libraryPath={libraryPath} />
        </LibraryProvider>
      )}
    </div>
  );
}
