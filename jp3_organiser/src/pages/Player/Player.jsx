/**
 * Player Page
 * 
 * Music player interface for browsing and playing from the library.
 * Shows tabs for Songs, Albums, Artists, and Playlists with play/queue actions.
 * 
 * Similar structure to View page but focused on playback rather than management.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useLibraryConfig, usePlayer } from '../../hooks';
import { useLibrary } from '../../hooks/useLibrary';
import { LoadingState, ErrorState, EmptyState, Header } from '../../components';
import styles from './Player.module.css';

import { TABS } from '../../utils/enums';
import TabSelector from './components/TabSelector';
import TabContent from './components/TabContent';

export default function Player() {
  const { libraryPath, isLoading: configLoading } = useLibraryConfig();
  const { setLibraryPath } = usePlayer();
  const [activeTab, setActiveTab] = useState(TABS.SONGS);
  
  const { library, isLoading, error, handleRefresh } = useLibrary(libraryPath);

  // Keep player context in sync with current library path
  useEffect(() => {
    if (libraryPath) {
      setLibraryPath(libraryPath);
    }
  }, [libraryPath, setLibraryPath]);

  // Stats for display
  const stats = useMemo(() => {
    if (!library) return { songs: 0, albums: 0, artists: 0, playlists: 0 };
    return {
      songs: library.songs?.length ?? 0,
      albums: library.albums?.length ?? 0,
      artists: library.artists?.length ?? 0,
      playlists: library.playlists?.length ?? 0,
    };
  }, [library]);

  if (configLoading) {
    return <LoadingState message="Loading configuration..." />;
  }

  if (!libraryPath) {
    return (
      <EmptyState 
        title="No Library Selected"
        message="Please go to Upload and select a library directory first."
      />
    );
  }

  return (
    <div className={styles.container}>
      <Header 
        title="Music Player"
        description="Browse and play your music library"
      />

      {isLoading && <LoadingState message="Loading library..." />}
      
      <ErrorState error={error} />

      {library && !isLoading && (
        <>
          <div className={styles.statsBar}>
            <span>{stats.songs} songs</span>
            <span>{stats.albums} albums</span>
            <span>{stats.artists} artists</span>
            <span>{stats.playlists} playlists</span>
            <button 
              className={styles.refreshBtn}
              onClick={handleRefresh}
              title="Refresh library"
            >
              Refresh
            </button>
          </div>

          <TabSelector 
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <div className={styles.content}>
            <TabContent 
              activeTab={activeTab}
              library={library}
            />
          </div>
        </>
      )}

      {!library && !error && !isLoading && (
        <EmptyState 
          title="No Library Data"
          message="Your library is empty. Upload some songs first."
        />
      )}
    </div>
  );
}
