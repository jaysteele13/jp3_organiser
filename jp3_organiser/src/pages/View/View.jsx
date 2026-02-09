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
import { useLocation, useNavigate } from 'react-router-dom';
import { useLibraryConfig, useToast } from '../../hooks';
import { useLibrary } from '../../hooks/useLibrary';
import { deleteSongs, deleteAlbum, deleteArtist, editSongMetadata, editAlbum, editArtist } from '../../services/libraryService';
import { LoadingState, ErrorState, EmptyState, Toast, ConfirmModal, LibrarySearch } from '../../components';
import styles from './View.module.css';

import { TABS, VIEW_TABS } from '../../utils/enums';

// Custom Components
import ViewHeader from './components/ViewHeader';
import StatsBar from './components/StatsBar/StatsBar';
import TabSelector from './components/Tabs/TabSelector';
import TabContent from './components/Tabs/TabContent';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import EditSongModal from './components/EditSongModal';
import EditAlbumModal from './components/EditAlbumModal';
import EditArtistModal from './components/EditArtistModal';

export default function View() {
  const location = useLocation();
  const navigate = useNavigate();
  const { libraryPath, isLoading: configLoading } = useLibraryConfig();
  
  // Use tab from navigation state if provided, otherwise default to SONGS
  const initialTab = location.state?.tab || TABS.SONGS;
  const [activeTab, setActiveTab] = useState(initialTab);
  
  const { library, isLoading, error, handleRefresh } = useLibrary(libraryPath);

  // Toast notification for feedback
  const toast = useToast();

  // Sync activeTab when navigation state changes (e.g., returning from PlaylistEdit)
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state?.tab]);

  // Handle navigation from Player with pre-set filters (state tracked here, effect below after clearAllFilters)
  const [showBackToPlayer, setShowBackToPlayer] = useState(false);

  // Handle back to player navigation
  const handleBackToPlayer = useCallback(() => {
    setShowBackToPlayer(false);
    navigate('/player');
  }, [navigate]);

  // Delete song modal state
  const [songsToDelete, setSongsToDelete] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete album modal state
  const [albumToDelete, setAlbumToDelete] = useState(null);
  const [showDeleteAlbumModal, setShowDeleteAlbumModal] = useState(false);

  // Delete artist modal state
  const [artistToDelete, setArtistToDelete] = useState(null);
  const [showDeleteArtistModal, setShowDeleteArtistModal] = useState(false);

  // Edit modal state
  const [songToEdit, setSongToEdit] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit album modal state
  const [albumToEdit, setAlbumToEdit] = useState(null);
  const [showEditAlbumModal, setShowEditAlbumModal] = useState(false);

  // Edit artist modal state
  const [artistToEdit, setArtistToEdit] = useState(null);
  const [showEditArtistModal, setShowEditArtistModal] = useState(false);

  // Song filter state - used to filter SongTable when selecting from LibrarySearch
  const [songFilter, setSongFilter] = useState(null); // stores song object or null

  // Album filter state - used to filter AlbumView when selecting from LibrarySearch
  const [albumFilter, setAlbumFilter] = useState(null); // stores album object or null

  // Artist filter state - used to filter ArtistView when selecting from LibrarySearch
  const [artistFilter, setArtistFilter] = useState(null); // stores artist object or null

  // Playlist filter state - used to filter PlaylistView when selecting from LibrarySearch
  const [playlistFilter, setPlaylistFilter] = useState(null); // stores playlist object or null

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSongFilter(null);
    setAlbumFilter(null);
    setArtistFilter(null);
    setPlaylistFilter(null);
  }, []);

  // Handle navigation from Player with pre-set filters
  useEffect(() => {
    const state = location.state;
    if (!state) return;
    
    // Check if navigating from Player
    if (state.fromPlayer) {
      setShowBackToPlayer(true);
      
      // Set appropriate filter based on what was passed
      if (state.filterSong) {
        clearAllFilters();
        setSongFilter(state.filterSong);
        setActiveTab(TABS.SONGS);
      } else if (state.filterAlbum) {
        clearAllFilters();
        setAlbumFilter(state.filterAlbum);
        setActiveTab(TABS.ALBUMS);
      } else if (state.filterArtist) {
        clearAllFilters();
        setArtistFilter(state.filterArtist);
        setActiveTab(TABS.ARTISTS);
      } else if (state.filterPlaylist) {
        clearAllFilters();
        setPlaylistFilter(state.filterPlaylist);
        setActiveTab(TABS.PLAYLISTS);
      }
      
      // Clear navigation state to prevent re-applying on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, clearAllFilters]);

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

  // Get song count for album/artist
  const getAlbumSongCount = (albumId) => {
    return library?.songs?.filter(s => s.albumId === albumId).length ?? 0;
  };

  const getArtistSongCount = (artistId) => {
    return library?.songs?.filter(s => s.artistId === artistId).length ?? 0;
  };

  const getArtistAlbumCount = (artistId) => {
    return library?.albums?.filter(a => a.artistId === artistId).length ?? 0;
  };

  // ============ SEARCH HANDLERS ============
  const handleSelectPlaylist = useCallback((playlist) => {
    // Set filter to show this playlist, then switch to Playlists tab
    clearAllFilters();
    setPlaylistFilter(playlist);
    setActiveTab(TABS.PLAYLISTS);
  }, [clearAllFilters]);

  const handleSelectArtist = useCallback((artist) => {
    // Set filter to show this artist, then switch to Artists tab
    clearAllFilters();
    setArtistFilter(artist);
    setActiveTab(TABS.ARTISTS);
  }, [clearAllFilters]);

  const handleSelectAlbum = useCallback((album) => {
    // Set filter to show this album, then switch to Albums tab
    clearAllFilters();
    setAlbumFilter(album);
    setActiveTab(TABS.ALBUMS);
  }, [clearAllFilters]);

  const handleSelectSong = useCallback((song) => {
    // Set filter to show this song in the table, then switch to Songs tab
    clearAllFilters();
    setSongFilter(song);
    setActiveTab(TABS.SONGS);
  }, [clearAllFilters]);

  // Handle tab change - clear all filters when switching tabs
  const handleTabChange = useCallback((tab) => {
    clearAllFilters();
    setActiveTab(tab);
  }, [clearAllFilters]);

  // ============ SONG DELETE HANDLERS ============
  const handleDeleteSongRequest = (song) => {
    setSongsToDelete([song]);
    setShowDeleteModal(true);
  };

  // Handle bulk delete request (from multiselect)
  const handleDeleteSongsRequest = (songs) => {
    setSongsToDelete(songs);
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteSong = async () => {
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
      toast.showToast('Failed to delete song', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDeleteSong = () => {
    if (isDeleting) return;
    setShowDeleteModal(false);
    setSongsToDelete([]);
  };

  // ============ ALBUM DELETE HANDLERS ============
  const handleDeleteAlbumRequest = (album) => {
    setAlbumToDelete(album);
    setShowDeleteAlbumModal(true);
  };

  const handleConfirmDeleteAlbum = async () => {
    if (!albumToDelete || !libraryPath) return;

    setIsDeleting(true);
    try {
      const result = await deleteAlbum(libraryPath, albumToDelete.id);
      setShowDeleteAlbumModal(false);
      setAlbumToDelete(null);
      handleRefresh();
      toast.showToast(
        `Deleted album "${result.albumName}" (${result.songsDeleted} song${result.songsDeleted !== 1 ? 's' : ''})`,
        'success'
      );
    } catch (err) {
      console.error('Failed to delete album:', err);
      toast.showToast('Failed to delete album', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDeleteAlbum = () => {
    if (isDeleting) return;
    setShowDeleteAlbumModal(false);
    setAlbumToDelete(null);
  };

  // ============ ARTIST DELETE HANDLERS ============
  const handleDeleteArtistRequest = (artist) => {
    setArtistToDelete(artist);
    setShowDeleteArtistModal(true);
  };

  const handleConfirmDeleteArtist = async () => {
    if (!artistToDelete || !libraryPath) return;

    setIsDeleting(true);
    try {
      const result = await deleteArtist(libraryPath, artistToDelete.id);
      setShowDeleteArtistModal(false);
      setArtistToDelete(null);
      handleRefresh();
      toast.showToast(
        `Deleted artist "${result.artistName}" (${result.songsDeleted} song${result.songsDeleted !== 1 ? 's' : ''}, ${result.albumsAffected} album${result.albumsAffected !== 1 ? 's' : ''})`,
        'success'
      );
    } catch (err) {
      console.error('Failed to delete artist:', err);
      toast.showToast('Failed to delete artist', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDeleteArtist = () => {
    if (isDeleting) return;
    setShowDeleteArtistModal(false);
    setArtistToDelete(null);
  };

  // ============ EDIT HANDLERS ============
  const handleEditRequest = (song) => {
    setSongToEdit(song);
    setShowEditModal(true);
  };

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

  const handleCancelEdit = () => {
    if (isSaving) return;
    setShowEditModal(false);
    setSongToEdit(null);
  };

  // ============ EDIT ALBUM HANDLERS ============
  const handleEditAlbumRequest = (album) => {
    setAlbumToEdit(album);
    setShowEditAlbumModal(true);
  };

  const handleConfirmEditAlbum = async (albumId, newName, newArtistName, newYear) => {
    if (!libraryPath) return;

    setIsSaving(true);
    try {
      const result = await editAlbum(libraryPath, albumId, newName, newArtistName, newYear);
      setShowEditAlbumModal(false);
      setAlbumToEdit(null);
      handleRefresh();

      // Show toast with edit result
      const messages = [`Album updated: "${result.oldName}" → "${result.newName}"`];
      if (result.artistCreated) messages.push('new artist created');
      messages.push(`${result.songsUpdated} song${result.songsUpdated !== 1 ? 's' : ''} updated`);
      toast.showToast(messages.join(', '), 'success');
    } catch (err) {
      console.error('Failed to edit album:', err);
      toast.showToast(err.toString() || 'Failed to edit album', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditAlbum = () => {
    if (isSaving) return;
    setShowEditAlbumModal(false);
    setAlbumToEdit(null);
  };

  // ============ EDIT ARTIST HANDLERS ============
  const handleEditArtistRequest = (artist) => {
    setArtistToEdit(artist);
    setShowEditArtistModal(true);
  };

  const handleConfirmEditArtist = async (artistId, newName) => {
    if (!libraryPath) return;

    setIsSaving(true);
    try {
      const result = await editArtist(libraryPath, artistId, newName);
      setShowEditArtistModal(false);
      setArtistToEdit(null);
      handleRefresh();

      // Show toast with edit result
      toast.showToast(
        `Artist updated: "${result.oldName}" → "${result.newName}" (${result.songsAffected} song${result.songsAffected !== 1 ? 's' : ''}, ${result.albumsAffected} album${result.albumsAffected !== 1 ? 's' : ''})`,
        'success'
      );
    } catch (err) {
      console.error('Failed to edit artist:', err);
      toast.showToast(err.toString() || 'Failed to edit artist', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditArtist = () => {
    if (isSaving) return;
    setShowEditArtistModal(false);
    setArtistToEdit(null);
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
    <div className={`${styles.container} ${styles.fadeIn}`}>
      <ViewHeader 
        libraryPath={libraryPath}
        handleRefresh={handleRefresh}
        isLoading={isLoading}
        showBackButton={showBackToPlayer}
        onBackClick={handleBackToPlayer}
      />

      <ErrorState error={error}/>

      {library && (
        <>
          <StatsBar 
            stats={stats} 
            libraryPath={libraryPath}
            onCompacted={handleRefresh}
          />
          <div className={styles.toolbar}>
            <TabSelector 
              setActiveTab={handleTabChange}
              activeTab={activeTab}
              tabs={VIEW_TABS}
            />
            <div className={styles.searchWrapper}>
              <LibrarySearch
                library={library}
                libraryPath={libraryPath}
                onSelectPlaylist={handleSelectPlaylist}
                onSelectArtist={handleSelectArtist}
                onSelectAlbum={handleSelectAlbum}
                onSelectSong={handleSelectSong}
                placeholder="Search playlists, artists, albums, songs..."
              />
            
            </div>
            
          </div>
          <div className={styles.content}>
            <TabContent 
              activeTab={activeTab} 
              library={library}
              libraryPath={libraryPath}
              songFilter={songFilter}
              albumFilter={albumFilter}
              artistFilter={artistFilter}
              playlistFilter={playlistFilter}
              onClearSongFilter={() => setSongFilter(null)}
              onClearAlbumFilter={() => setAlbumFilter(null)}
              onClearArtistFilter={() => setArtistFilter(null)}
              onClearPlaylistFilter={() => setPlaylistFilter(null)}
              onDeleteSong={handleDeleteSongRequest}
              onDeleteSongs={handleDeleteSongsRequest}
              onEditSong={handleEditRequest}
              onDeleteAlbum={handleDeleteAlbumRequest}
              onEditAlbum={handleEditAlbumRequest}
              onDeleteArtist={handleDeleteArtistRequest}
              onEditArtist={handleEditArtistRequest}
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

      {/* Delete Song Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          songs={songsToDelete}
          onConfirm={handleConfirmDeleteSong}
          onCancel={handleCancelDeleteSong}
          isDeleting={isDeleting}
        />
      )}

      {/* Delete Album Modal */}
      {showDeleteAlbumModal && albumToDelete && (
        <ConfirmModal
          title="Delete Album?"
          message={`This will permanently delete all ${getAlbumSongCount(albumToDelete.id)} song(s) from this album. The audio files will be removed from disk.`}
          confirmLabel="Delete Album"
          variant="danger"
          onConfirm={handleConfirmDeleteAlbum}
          onCancel={handleCancelDeleteAlbum}
          isLoading={isDeleting}
        >
          <div className={styles.deleteInfo}>
            <div className={styles.deleteInfoTitle}>{albumToDelete.name}</div>
            <div className={styles.deleteInfoSubtitle}>by {albumToDelete.artistName}</div>
          </div>
        </ConfirmModal>
      )}

      {/* Delete Artist Modal */}
      {showDeleteArtistModal && artistToDelete && (
        <ConfirmModal
          title="Delete Artist?"
          message={`This will permanently delete all ${getArtistSongCount(artistToDelete.id)} song(s) across ${getArtistAlbumCount(artistToDelete.id)} album(s) by this artist. The audio files will be removed from disk.`}
          confirmLabel="Delete Artist"
          variant="danger"
          onConfirm={handleConfirmDeleteArtist}
          onCancel={handleCancelDeleteArtist}
          isLoading={isDeleting}
        >
          <div className={styles.deleteInfo}>
            <div className={styles.deleteInfoTitle}>{artistToDelete.name}</div>
          </div>
        </ConfirmModal>
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

      {/* Edit Album Modal */}
      {showEditAlbumModal && (
        <EditAlbumModal
          album={albumToEdit}
          onSave={handleConfirmEditAlbum}
          onCancel={handleCancelEditAlbum}
          isSaving={isSaving}
        />
      )}

      {/* Edit Artist Modal */}
      {showEditArtistModal && (
        <EditArtistModal
          artist={artistToEdit}
          onSave={handleConfirmEditArtist}
          onCancel={handleCancelEditArtist}
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
