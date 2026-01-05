/**
 * View Page
 * 
 * Displays the library contents parsed directly from library.bin.
 * Shows tabs for Songs, Albums, Artists, and Playlists.
 * 
 * Data is loaded fresh from the jp3 folder on disk each time,
 * mimicking how the ESP32 would parse the binary format.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLibraryConfig } from '../../hooks';
import { useLibrary } from '../../hooks/useLibrary';
import { deleteSongs, listPlaylists } from '../../services/libraryService';
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
  const { libraryPath, isLoading: configLoading } = useLibraryConfig();
  const [activeTab, setActiveTab] = useState(TABS.SONGS);
  const { library, isLoading, error, handleRefresh } = useLibrary(libraryPath);

  // Playlists state (fetched separately from library.bin)
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);

  // Delete modal state
  const [songsToDelete, setSongsToDelete] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch playlists
  const fetchPlaylists = useCallback(async () => {
    if (!libraryPath) return;
    setPlaylistsLoading(true);
    try {
      const data = await listPlaylists(libraryPath);
      setPlaylists(data);
    } catch (err) {
      console.error('Failed to load playlists:', err);
      setPlaylists([]);
    } finally {
      setPlaylistsLoading(false);
    }
  }, [libraryPath]);

  // Load playlists when library path changes
  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  // Combined refresh function
  const handleFullRefresh = useCallback(() => {
    handleRefresh();
    fetchPlaylists();
  }, [handleRefresh, fetchPlaylists]);

  // Stats for header
  const stats = useMemo(() => {
    if (!library) return { songs: 0, albums: 0, artists: 0, playlists: 0 };
    return {
      songs: library.songs.length,
      albums: library.albums.length,
      artists: library.artists.length,
      playlists: playlists.length,
    };
  }, [library, playlists]);

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
      handleFullRefresh();
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
        handleRefresh={handleFullRefresh}
        isLoading={isLoading || playlistsLoading}
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
              playlists={playlists}
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
