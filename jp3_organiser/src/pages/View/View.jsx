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
import { useLibraryConfig, useToast } from '../../hooks';
import { useLibrary } from '../../hooks/useLibrary';
import { deleteSongs, editSongMetadata } from '../../services/libraryService';
import { LoadingState, ErrorState, EmptyState, Toast } from '../../components';
import styles from './View.module.css';

import { TABS, VIEW_TABS } from '../../utils/enums';

// Custom Components
import ViewHeader from './components/ViewHeader';
import StatsBar from './components/StatsBar/StatsBar';
import TabSelector from './components/Tabs/TabSelector';
import TabContent from './components/Tabs/TabContent';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import EditSongModal from './components/EditSongModal';

export default function View() {
  const location = useLocation();
  const { libraryPath, isLoading: configLoading } = useLibraryConfig();
  
  // Use tab from navigation state if provided, otherwise default to SONGS
  const initialTab = location.state?.tab || TABS.SONGS;
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const { library, isLoading, error, handleRefresh } = useLibrary(libraryPath);

  // Toast notification for edit feedback
  const toast = useToast();

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

  // Edit modal state
  const [songToEdit, setSongToEdit] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  // Handle edit request from SongView
  const handleEditRequest = (song) => {
    setSongToEdit(song);
    setShowEditModal(true);
  };

  // Handle confirmed edit
  const handleConfirmEdit = async (songId, metadata) => {
    if (!libraryPath) return;

    setIsSaving(true);
    try {
      const result = await editSongMetadata(libraryPath, songId, metadata);
      setShowEditModal(false);
      setSongToEdit(null);
      handleRefresh();

      // Show toast with edit result
      const messages = ['Song updated'];
      if (result.artistCreated) messages.push('new artist created');
      if (result.albumCreated) messages.push('new album created');
      if (result.playlistsUpdated > 0) {
        messages.push(`${result.playlistsUpdated} playlist${result.playlistsUpdated > 1 ? 's' : ''} updated`);
      }
      toast.showToast(messages.join(', '), 'success');
    } catch (err) {
      console.error('Failed to edit song:', err);
      toast.showToast('Failed to edit song', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    if (isSaving) return;
    setShowEditModal(false);
    setSongToEdit(null);
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
          <StatsBar 
            stats={stats} 
            libraryPath={libraryPath}
            onCompacted={handleRefresh}
          />
          <TabSelector 
            setActiveTab={setActiveTab}
            activeTab={activeTab}
            tabs={VIEW_TABS}
          />
          <div className={styles.content}>
            <TabContent 
              activeTab={activeTab} 
              library={library}
              libraryPath={libraryPath}
              onDeleteSong={handleDeleteRequest}
              onEditSong={handleEditRequest}
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

      {showEditModal && (
        <EditSongModal
          song={songToEdit}
          libraryPath={libraryPath}
          onSave={handleConfirmEdit}
          onCancel={handleCancelEdit}
          isSaving={isSaving}
        />
      )}

      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={toast.hideToast}
      />
    </div>
  );
}
