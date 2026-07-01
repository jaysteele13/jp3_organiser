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
import { useEntityModal } from '../../hooks/useEntityModal';
import { useLibrary } from '../../hooks/useLibrary';
import { deleteSongs, deleteAlbum, deleteArtist, editSongMetadata, editAlbum, editArtist } from '../../services/libraryService';
import { LoadingState, ErrorState, EmptyState, Toast, ConfirmModal, LibrarySearch } from '../../components';
import styles from './View.module.css';

import { TABS, VIEW_TABS } from '../../utils/enums';
import { pluralize } from '../../utils/pluralize';

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

  // Listen for CoverArtArchive proxy errors (5xx) and show a single toast
  useEffect(() => {
    function handleProxyError(e) {
      const status = e.detail || 'Unknown';
      toast.showToast(`CoverArt proxy issue on their end: ${status}`, 'error');
    }
    window.addEventListener('coverart-proxy-error', handleProxyError);
    return () => window.removeEventListener('coverart-proxy-error', handleProxyError);
  }, [toast]);

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
  const songDelete = useEntityModal();
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete album modal state
  const albumDelete = useEntityModal();

  // Delete artist modal state
  const artistDelete = useEntityModal();

  // Edit modal state
  const songEdit = useEntityModal();
  const [isSaving, setIsSaving] = useState(false);

  // Edit album modal state
  const albumEdit = useEntityModal();

  // Edit artist modal state
  const artistEdit = useEntityModal();

  // Consolidated filter state used by the active tab content
  const [filter, setFilter] = useState(null); // { type: 'song'|'album'|'artist'|'playlist', value } | null

  const clearAllFilters = useCallback(() => {
    setFilter(null);
  }, []);

  const selectAndSwitchTab = useCallback((type, value, tab) => {
    setFilter({ type, value });
    setActiveTab(tab);
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
        setFilter({ type: 'song', value: state.filterSong });
        setActiveTab(TABS.SONGS);
      } else if (state.filterAlbum) {
        setFilter({ type: 'album', value: state.filterAlbum });
        setActiveTab(TABS.ALBUMS);
      } else if (state.filterArtist) {
        setFilter({ type: 'artist', value: state.filterArtist });
        setActiveTab(TABS.ARTISTS);
      } else if (state.filterPlaylist) {
        setFilter({ type: 'playlist', value: state.filterPlaylist });
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
    selectAndSwitchTab('playlist', playlist, TABS.PLAYLISTS);
  }, [selectAndSwitchTab]);

  const handleSelectArtist = useCallback((artist) => {
    selectAndSwitchTab('artist', artist, TABS.ARTISTS);
  }, [selectAndSwitchTab]);

  const handleSelectAlbum = useCallback((album) => {
    selectAndSwitchTab('album', album, TABS.ALBUMS);
  }, [selectAndSwitchTab]);

  const handleSelectSong = useCallback((song) => {
    selectAndSwitchTab('song', song, TABS.SONGS);
  }, [selectAndSwitchTab]);


  // Handle tab change - clear all filters when switching tabs
  const handleTabChange = useCallback((tab) => {
    clearAllFilters();
    setActiveTab(tab);
  }, [clearAllFilters]);

  // ============ SONG DELETE HANDLERS ============
  const handleDeleteSongRequest = (song) => {
    songDelete.open([song]);
  };

  // Handle bulk delete request (from multiselect)
  const handleDeleteSongsRequest = (songs) => {
    songDelete.open(songs);
  };

  const handleConfirmDeleteSong = async () => {
    const songsToDelete = songDelete.item ?? [];
    if (songsToDelete.length === 0 || !libraryPath) return;

    setIsDeleting(true);
    try {
      const songIds = songsToDelete.map(song => song.id);
      await deleteSongs(libraryPath, songIds);
      songDelete.close();
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
    songDelete.close();
  };

  // ============ ALBUM DELETE HANDLERS ============
  const handleDeleteAlbumRequest = (album) => {
    albumDelete.open(album);
  };

  const handleConfirmDeleteAlbum = async () => {
    if (!albumDelete.item || !libraryPath) return;

    setIsDeleting(true);
    try {
      const result = await deleteAlbum(libraryPath, albumDelete.item.id);
      albumDelete.close();
      handleRefresh();
      toast.showToast(
        `Deleted album "${result.albumName}" (${pluralize(result.songsDeleted, 'song')})`,
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
    albumDelete.close();
  };

  // ============ ARTIST DELETE HANDLERS ============
  const handleDeleteArtistRequest = (artist) => {
    artistDelete.open(artist);
  };

  const handleConfirmDeleteArtist = async () => {
    if (!artistDelete.item || !libraryPath) return;

    setIsDeleting(true);
    try {
      const result = await deleteArtist(libraryPath, artistDelete.item.id);
      artistDelete.close();
      handleRefresh();
      toast.showToast(
        `Deleted artist "${result.artistName}" (${pluralize(result.songsDeleted, 'song')}, ${pluralize(result.albumsAffected, 'album')})`,
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
    artistDelete.close();
  };

  // ============ EDIT HANDLERS ============
  const handleEditRequest = (song) => {
    songEdit.open(song);
  };

  const handleConfirmEdit = async (songId, metadata) => {
    if (!libraryPath) return;

    setIsSaving(true);
    try {
      const result = await editSongMetadata(libraryPath, songId, metadata);
      songEdit.close();
      handleRefresh();

      // Show toast with edit result
      const messages = ['Song updated'];
      if (result.artistCreated) messages.push('new artist created');
      if (result.albumCreated) messages.push('new album created');
      if (result.playlistsUpdated > 0) {
        messages.push(`${pluralize(result.playlistsUpdated, 'playlist')} updated`);
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
    songEdit.close();
  };

  // ============ EDIT ALBUM HANDLERS ============
  const handleEditAlbumRequest = (album) => {
    albumEdit.open(album);
  };

  const handleConfirmEditAlbum = async (albumId, newName, newArtistName, newYear) => {
    if (!libraryPath) return;

    setIsSaving(true);
    try {
      const result = await editAlbum(libraryPath, albumId, newName, newArtistName, newYear);
      albumEdit.close();
      handleRefresh();

      // Show toast with edit result
      const messages = [`Album updated: "${result.oldName}" → "${result.newName}"`];
      if (result.artistCreated) messages.push('new artist created');
      messages.push(`${pluralize(result.songsUpdated, 'song')} updated`);
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
    albumEdit.close();
  };

  // ============ EDIT ARTIST HANDLERS ============
  const handleEditArtistRequest = (artist) => {
    artistEdit.open(artist);
  };

  const handleConfirmEditArtist = async (artistId, newName) => {
    if (!libraryPath) return;

    setIsSaving(true);
    try {
      const result = await editArtist(libraryPath, artistId, newName);
      artistEdit.close();
      handleRefresh();

      // Show toast with edit result
      toast.showToast(
        `Artist updated: "${result.oldName}" → "${result.newName}" (${pluralize(result.songsAffected, 'song')}, ${pluralize(result.albumsAffected, 'album')})`,
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
    artistEdit.close();
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
              songFilter={filter?.type === 'song' ? filter.value : null}
              albumFilter={filter?.type === 'album' ? filter.value : null}
              artistFilter={filter?.type === 'artist' ? filter.value : null}
              playlistFilter={filter?.type === 'playlist' ? filter.value : null}
              onClearSongFilter={() => setFilter((current) => current?.type === 'song' ? null : current)}
              onClearAlbumFilter={() => setFilter((current) => current?.type === 'album' ? null : current)}
              onClearArtistFilter={() => setFilter((current) => current?.type === 'artist' ? null : current)}
              onClearPlaylistFilter={() => setFilter((current) => current?.type === 'playlist' ? null : current)}
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
      {songDelete.isOpen && songDelete.item && (
        <DeleteConfirmModal
          songs={songDelete.item}
          onConfirm={handleConfirmDeleteSong}
          onCancel={handleCancelDeleteSong}
          isDeleting={isDeleting}
        />
      )}

      {/* Delete Album Modal */}
      {albumDelete.isOpen && albumDelete.item && (
        <ConfirmModal
          title="Delete Album?"
          message={`This will permanently delete all ${getAlbumSongCount(albumDelete.item.id)} song(s) from this album. The audio files will be removed from disk.`}
          confirmLabel="Delete Album"
          variant="danger"
          onConfirm={handleConfirmDeleteAlbum}
          onCancel={handleCancelDeleteAlbum}
          isLoading={isDeleting}
        >
          <div className={styles.deleteInfo}>
            <div className={styles.deleteInfoTitle}>{albumDelete.item.name}</div>
            <div className={styles.deleteInfoSubtitle}>by {albumDelete.item.artistName}</div>
          </div>
        </ConfirmModal>
      )}

      {/* Delete Artist Modal */}
      {artistDelete.isOpen && artistDelete.item && (
        <ConfirmModal
          title="Delete Artist?"
          message={`This will permanently delete all ${getArtistSongCount(artistDelete.item.id)} song(s) across ${getArtistAlbumCount(artistDelete.item.id)} album(s) by this artist. The audio files will be removed from disk.`}
          confirmLabel="Delete Artist"
          variant="danger"
          onConfirm={handleConfirmDeleteArtist}
          onCancel={handleCancelDeleteArtist}
          isLoading={isDeleting}
        >
          <div className={styles.deleteInfo}>
            <div className={styles.deleteInfoTitle}>{artistDelete.item.name}</div>
          </div>
        </ConfirmModal>
      )}

      {songEdit.isOpen && songEdit.item && (
        <EditSongModal
          song={songEdit.item}
          libraryPath={libraryPath}
          onSave={handleConfirmEdit}
          onCancel={handleCancelEdit}
          isSaving={isSaving}
        />
      )}

      {/* Edit Album Modal */}
      {albumEdit.isOpen && albumEdit.item && (
        <EditAlbumModal
          album={albumEdit.item}
          onSave={handleConfirmEditAlbum}
          onCancel={handleCancelEditAlbum}
          isSaving={isSaving}
        />
      )}

      {/* Edit Artist Modal */}
      {artistEdit.isOpen && artistEdit.item && (
        <EditArtistModal
          artist={artistEdit.item}
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
