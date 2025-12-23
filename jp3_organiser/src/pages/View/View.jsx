/**
 * View Page
 * 
 * Displays the library contents parsed directly from library.bin.
 * Shows tabs for Songs, Albums, Artists, and Playlists.
 * 
 * Data is loaded fresh from the jp3 folder on disk each time,
 * mimicking how the ESP32 would parse the binary format.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { loadLibrary } from '../../services';
import { useLibraryConfig } from '../../hooks';
import styles from './View.module.css';

import {TABS} from '../../utils/enums'

// Custom Components
import ViewHeader from './components/ViewHeader';
import StatsBar from './components/StatsBar/StatsBar';
import TabSelector from './components/Tabs/TabSelector';
import SongView from './components/Tabs/Songs'
import AlbumView from './components/Tabs/Albums'
import ArtistView from './components/Tabs/Artists'
import PlaylistView from './components/Tabs/Playlists'

export default function View() {
  const { libraryPath, isLoading: configLoading } = useLibraryConfig();
  const [activeTab, setActiveTab] = useState(TABS.SONGS);
  const [library, setLibrary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load library from disk when path changes or component mounts
  useEffect(() => {
    if (!libraryPath) return;

    const fetchLibrary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await loadLibrary(libraryPath);
        setLibrary(data);
      } catch (err) {
        setError(err.toString());
        setLibrary(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLibrary();
  }, [libraryPath]);

  // Refresh library data
  const handleRefresh = async () => {
    if (!libraryPath) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await loadLibrary(libraryPath);
      setLibrary(data);
    } catch (err) {
      setError(err.toString());
    } finally {
      setIsLoading(false);
    }
  };

  // Stats for header
  const stats = useMemo(() => {
    if (!library) return { songs: 0, albums: 0, artists: 0 };
    return {
      songs: library.songs.length,
      albums: library.albums.length,
      artists: library.artists.length,
    };
  }, [library]);

  if (configLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading configuration...</div>
      </div>
    );
  }

  if (!libraryPath) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>No Library Selected</h2>
          <p>Please go to Upload and select a library directory first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ViewHeader libraryPath={libraryPath}
      handleRefresh={handleRefresh}
      isLoading={isLoading}/>

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      {library && (
        <>
          <StatsBar stats={stats}/>
          <TabSelector setActiveTab={setActiveTab}
          activeTab={activeTab}/>
          <div className={styles.content}>
            {activeTab === TABS.SONGS && (
              <SongView library={library}/>
            )}

            {activeTab === TABS.ALBUMS && (
              <AlbumView library={library}/>
            )}

            {activeTab === TABS.ARTISTS && (
              <ArtistView
              library={library}/>
            )}

            {activeTab === TABS.PLAYLISTS && (
              <PlaylistView/>
            )}
          </div>
        </>
      )}

      {!library && !error && !isLoading && (
        <div className={styles.emptyState}>
          <h3>No Library Data</h3>
          <p>The library.bin file is empty or could not be parsed.</p>
        </div>
      )}
    </div>
  );
}
