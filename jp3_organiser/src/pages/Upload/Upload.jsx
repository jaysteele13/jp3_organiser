import React from 'react';
import Header from '../../components/Header';
import DirectoryConfig from './components/DirectoryConfig';
import UploadFile from './components/UploadFile';
import { useLibraryConfig } from '../../hooks';

/**
 * Upload Page
 * 
 * Main page for uploading music files to JP3 Organiser.
 * 
 * Flow:
 * 1. User must first configure the library directory
 * 2. Once configured, user can upload audio files
 * 3. (Future) Files will be processed through metadata extraction pipeline
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
      <>
        <Header
          title="Upload Music"
          description="Prepare your music for the ESP32"
        />
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.7 }}>
          Loading configuration...
        </div>
      </>
    );
  }

  return (
    <>
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
    </>
  );
}
