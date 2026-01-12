/**
 * Player Page
 * 
 * Music player interface for browsing and playing from the library.
 * Shows tabs for Songs, Albums, Artists, and Playlists with play/queue actions.
 * 
 * Similar structure to View page but focused on playback rather than management.
 * 
 * Supports navigation state for triggering playback:
 * - state.playSong: Song object to play immediately
 * - state.playContext: Array of songs for next/prev navigation
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useLibraryConfig, usePlayer } from '../../hooks';
import { useLibrary } from '../../hooks/useLibrary';
import { LoadingState, ErrorState, EmptyState } from '../../components';
import StatsBar from '../View/components/StatsBar'
import styles from './Player.module.css';

import { TABS } from '../../utils/enums';
import TabSelector from '../View/components/Tabs/TabSelector';
import TabContent from './components/TabContent';

// Valid tab values for URL parameter validation
const VALID_TABS = Object.values(TABS);

export default function Player() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { libraryPath, isLoading: configLoading } = useLibraryConfig();
  const { setLibraryPath, playTrack } = usePlayer();
  const hasTriggeredPlayback = useRef(false);
  
  // Read tab from URL, default to HOME if invalid or missing
  const tabParam = searchParams.get('tab');
  const initialTab = VALID_TABS.includes(tabParam) ? tabParam : TABS.HOME;
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab state with URL parameter
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === TABS.HOME) {
      // Remove tab param for home (clean URL)
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };
  
  const { library, isLoading, error, handleRefresh } = useLibrary(libraryPath);

  // Keep player context in sync with current library path
  useEffect(() => {
    if (libraryPath) {
      setLibraryPath(libraryPath);
    }
  }, [libraryPath, setLibraryPath]);

  // Handle navigation state for triggering playback (e.g., from View page)
  useEffect(() => {
    if (location.state?.playSong && !hasTriggeredPlayback.current) {
      hasTriggeredPlayback.current = true;
      const song = location.state.playSong;
      const context = location.state.playContext || [song];
      playTrack(song, context);
      
      // Clear the state to prevent replay on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, playTrack]);

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
      {isLoading && <LoadingState message="Loading library..." />}
      
      <ErrorState error={error} />

      {library && !isLoading && (
        <>
          <StatsBar stats={stats} />

          <TabSelector 
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            tabs={TABS}
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
