/**
 * View Page
 * 
 * Displays the library contents parsed directly from library.bin.
 * Shows tabs for Songs, Albums, Artists, and Playlists.
 * 
 * Data is loaded fresh from the jp3 folder on disk each time,
 * mimicking how the ESP32 would parse the binary format.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLibraryConfig } from '../../hooks';
import { useLibrary } from '../../hooks/useLibrary';
import { deleteSongs } from '../../services/libraryService';
import { LoadingState, ErrorState, EmptyState } from '../../components';
import styles from './View.module.css';

import { TABS } from '../../utils/enums';

// Custom Components
import ViewHeader from './components/ViewHeader';
import StatsBar from './components/StatsBar/StatsBar';
import TabSelector from './components/Tabs/TabSelector';
import TabContent from './components/Tabs/TabContent';
import DeleteConfirmModal from './components/DeleteConfirmModal';

export default function View() {
  const location = useLocation();
  const { libraryPath, isLoading: configLoading } = useLibraryConfig();
  
  // Use tab from navigation state if provided, otherwise default to SONGS
  const initialTab = location.state?.tab || TABS.SONGS;
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const { library, isLoading, error, handleRefresh } = useLibrary(libraryPath);

  // Sync activeTab when navigation state changes (e.g., returning from PlaylistEdit)
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state?.tab]);

  // Delete modal state
  const [songsToDelete, setSongsToDelete] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Stats for header
  const stats = useMemo(() => {
    if (!library) return { songs: 0, albums: 0, artists: 0, playlists: 0 };
    return {
      songs: library.songs?.length ?? 0,
      albums: library.albums?.length ?? 0,
      artists: library.artists?.length ?? 0,
      playlists: library.playlists?.length ?? 0,
    };
  }, [library]);

  // Handle delete request from SongView
  const handleDeleteRequest = (song) => {
    setSongsToDelete([song]);
    setShowDeleteModal(true);
  };

  // Handle confirmed delete
  const handleConfirmDelete = async () => {
    if (songsToDelete.length === 0 || !libraryPath) return;

    setIsDeleting(true);
    try {
      const songIds = songsToDelete.map(song => song.id);
      await deleteSongs(libraryPath, songIds);
      setShowDeleteModal(false);
      setSongsToDelete([]);
      handleRefresh();
    } catch (err) {
      console.error('Failed to delete songs:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle cancel delete
  const handleCancelDelete = () => {
    if (isDeleting) return;
    setShowDeleteModal(false);
    setSongsToDelete([]);
  };

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
      <ViewHeader 
        libraryPath={libraryPath}
        handleRefresh={handleRefresh}
        isLoading={isLoading}
      />

      <ErrorState error={error}/>

      {library && (
        <>
          <StatsBar stats={stats}/>
          <TabSelector 
            setActiveTab={setActiveTab}
            activeTab={activeTab}
          />
          <div className={styles.content}>
            <TabContent 
              activeTab={activeTab} 
              library={library}
              libraryPath={libraryPath}
              onDeleteSong={handleDeleteRequest}
            />
          </div>
        </>
      )}

      {!library && !error && !isLoading && (
        <EmptyState 
          title="No Library Data"
          message="The library.bin file is empty or could not be parsed."
        />
      )}

      {showDeleteModal && (
        <DeleteConfirmModal
          songs={songsToDelete}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          isDeleting={isDeleting}/>
      )}
    </div>
  );
}
