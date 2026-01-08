/**
 * PlaylistEdit Page
 * 
 * Full-page editor for managing playlist contents.
 * Shows current songs with remove buttons, and a song picker to add new songs.
 * Uses two-column layout for better use of screen space.
 * 
 * Route: /playlist/:id
 */

import { useMemo, useState, useCallback, useEffect, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLibraryConfig } from '../../hooks';
import { useLibrary } from '../../hooks/useLibrary';
import { deletePlaylistByName, listPlaylists } from '../../services/libraryService';
import { LoadingState, ErrorState, EmptyState, ConfirmModal } from '../../components';
import { TABS, UPLOAD_MODE } from '../../utils/enums';
import usePlaylistEdit from './usePlaylistEdit';
import styles from './PlaylistEdit.module.css';

/**
 * Build a lookup map from song ID to song details
 */
function buildSongLookup(library) {
  const lookup = new Map();
  if (library?.songs) {
    library.songs.forEach(song => {
      lookup.set(song.id, song);
    });
  }
  return lookup;
}

/**
 * CurrentSongRow - Song in playlist with remove button
 * Memoized to prevent unnecessary re-renders in large lists.
 */
const CurrentSongRow = memo(function CurrentSongRow({ song, index, onRemove, isDisabled }) {
  return (
    <tr className={styles.songRow}>
      <td className={styles.cellIndex}>{index + 1}</td>
      <td className={styles.cellTitle}>{song?.title || 'Unknown'}</td>
      <td className={styles.cellArtist}>{song?.artistName || 'Unknown'}</td>
      <td className={styles.cellAction}>
        <button
          className={styles.removeBtn}
          onClick={() => onRemove(song.id)}
          disabled={isDisabled}
          title="Remove from playlist"
        >
          ×
        </button>
      </td>
    </tr>
  );
});

/**
 * PickerSongRow - Song in the add picker with checkbox
 * Memoized to prevent unnecessary re-renders in large lists.
 */
const PickerSongRow = memo(function PickerSongRow({ song, isSelected, isInPlaylist, onToggle }) {
  const handleClick = () => {
    if (!isInPlaylist) {
      onToggle(song.id);
    }
  };

  return (
    <tr 
      className={`${styles.pickerRow} ${isInPlaylist ? styles.pickerRowDisabled : ''} ${isSelected ? styles.pickerRowSelected : ''}`}
      onClick={handleClick}
    >
      <td className={styles.cellCheckbox}>
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isInPlaylist}
          onChange={() => onToggle(song.id)}
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td className={styles.cellTitle}>{song.title}</td>
      <td className={styles.cellArtist}>{song.artistName}</td>
      <td className={styles.cellAlbum}>{song.albumName}</td>
      <td className={styles.cellStatus}>
        {isInPlaylist && <span className={styles.inPlaylistBadge}>Added</span>}
      </td>
    </tr>
  );
});

export default function PlaylistEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const playlistId = parseInt(id, 10);

  const { libraryPath, isLoading: configLoading } = useLibraryConfig();
  const { library, isLoading: libraryLoading } = useLibrary(libraryPath);

  const editor = usePlaylistEdit(libraryPath, playlistId);
  const {
    playlist,
    isLoading: playlistLoading,
    isSaving,
    error,
    selectedSongIds,
    searchQuery,
    debouncedSearchQuery,
    playlistSongIdSet,
    removeSong,
    addSelectedSongs,
    toggleSongSelection,
    clearSelection,
    updateSearchQuery,
    renameCurrentPlaylist,
  } = editor;

  const songLookup = useMemo(() => buildSongLookup(library), [library]);
  const allSongs = library?.songs || [];

  // Filter songs for picker based on debounced search query
  const filteredSongs = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return allSongs;
    }
    const query = debouncedSearchQuery.toLowerCase();
    return allSongs.filter(song => 
      song.title.toLowerCase().includes(query) ||
      song.artistName.toLowerCase().includes(query) ||
      song.albumName.toLowerCase().includes(query)
    );
  }, [allSongs, debouncedSearchQuery]);

  // Get current playlist songs with details
  const currentSongs = useMemo(() => {
    if (!playlist?.songIds) return [];
    return playlist.songIds.map(id => songLookup.get(id)).filter(Boolean);
  }, [playlist?.songIds, songLookup]);

  const handleBack = () => {
    navigate('/view', { state: { tab: TABS.PLAYLISTS } });
  };

  // Navigate to upload page with pre-set playlist context
  const handleUploadToPlaylist = useCallback(() => {
    if (!playlist) return;
    navigate('/upload', { 
      state: { 
        mode: UPLOAD_MODE.PLAYLIST,
        playlistId: playlist.id,
        playlistName: playlist.name,
      }
    });
  }, [navigate, playlist]);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Rename state
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [existingPlaylists, setExistingPlaylists] = useState([]);

  // Fetch existing playlists for duplicate name validation
  useEffect(() => {
    if (!libraryPath) return;
    
    let cancelled = false;
    listPlaylists(libraryPath)
      .then((playlists) => {
        if (!cancelled) {
          setExistingPlaylists(playlists);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch playlists:', err);
      });

    return () => { cancelled = true; };
  }, [libraryPath]);

  const handleRenameClick = useCallback(() => {
    if (playlist) {
      setNewPlaylistName(playlist.name);
      setRenameError('');
      setShowRenameModal(true);
    }
  }, [playlist]);

  const handleConfirmRename = async () => {
    const trimmedName = newPlaylistName.trim();
    
    // Validate
    if (!trimmedName) {
      setRenameError('Playlist name cannot be empty');
      return;
    }

    // Check for duplicate name (case-insensitive, excluding current playlist)
    const isDuplicate = existingPlaylists.some(
      p => p.name.toLowerCase() === trimmedName.toLowerCase() && p.id !== playlist?.id
    );
    if (isDuplicate) {
      setRenameError('A playlist with this name already exists');
      return;
    }

    setIsRenaming(true);
    setRenameError('');

    const result = await renameCurrentPlaylist(trimmedName);

    if (result.success) {
      setShowRenameModal(false);
      // Update the existingPlaylists cache with new name
      setExistingPlaylists(prev => 
        prev.map(p => p.id === playlist?.id ? { ...p, name: trimmedName } : p)
      );
    } else {
      setRenameError(result.error || 'Failed to rename playlist');
    }

    setIsRenaming(false);
  };

  const handleCancelRename = () => {
    if (isRenaming) return;
    setShowRenameModal(false);
    setRenameError('');
  };

  const handleRenameInputChange = (e) => {
    setNewPlaylistName(e.target.value);
    // Clear error when user starts typing
    if (renameError) {
      setRenameError('');
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!playlist || !libraryPath) return;

    setIsDeleting(true);
    try {
      await deletePlaylistByName(libraryPath, playlist.name);
      navigate('/view', { state: { tab: TABS.PLAYLISTS } });
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setShowDeleteModal(false);
  };

  // Loading states
  if (configLoading || libraryLoading || playlistLoading) {
    return <LoadingState message="Loading playlist..." />;
  }

  // Error states
  if (!libraryPath) {
    return (
      <EmptyState 
        title="No Library Selected"
        message="Please go to Upload and select a library directory first."
      />
    );
  }

  if (isNaN(playlistId)) {
    return (
      <EmptyState 
        title="Invalid Playlist"
        message="The playlist ID is not valid."
      />
    );
  }

  if (!playlist && !playlistLoading) {
    return (
      <EmptyState 
        title="Playlist Not Found"
        message="The playlist could not be loaded."
      />
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={handleBack}>
            ← Back
          </button>
          <div className={styles.headerInfo}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{playlist?.name}</h1>
              <button
                className={styles.editNameBtn}
                onClick={handleRenameClick}
                title="Rename playlist"
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </button>
            </div>
            <span className={styles.subtitle}>
              {currentSongs.length} song{currentSongs.length !== 1 ? 's' : ''} in playlist
            </span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.uploadBtn}
            onClick={handleUploadToPlaylist}
            title="Upload new songs directly to this playlist"
          >
            Upload New Songs
          </button>
          <button 
            className={styles.deleteBtn}
            onClick={handleDeleteClick}
            title="Delete playlist"
          >
            Delete Playlist
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && <ErrorState error={error} />}

      {/* Main content - two columns */}
      <div className={styles.content}>
        {/* Left column - Current songs */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Playlist Songs</h2>
          
          {currentSongs.length === 0 ? (
            <div className={styles.emptySection}>
              <p>This playlist is empty.</p>
              <p>Add songs from the library on the right.</p>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thIndex}>#</th>
                    <th>Title</th>
                    <th>Artist</th>
                    <th className={styles.thAction}></th>
                  </tr>
                </thead>
                <tbody>
                  {currentSongs.map((song, index) => (
                    <CurrentSongRow
                      key={song.id}
                      song={song}
                      index={index}
                      onRemove={removeSong}
                      isDisabled={isSaving}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right column - Add songs */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Add from Library</h2>
            {selectedSongIds.size > 0 && (
              <div className={styles.selectionActions}>
                <span className={styles.selectionCount}>
                  {selectedSongIds.size} selected
                </span>
                <button
                  className={styles.clearBtn}
                  onClick={clearSelection}
                >
                  Clear
                </button>
                <button
                  className={styles.addBtn}
                  onClick={addSelectedSongs}
                  disabled={isSaving}
                >
                  {isSaving ? 'Adding...' : `Add ${selectedSongIds.size} Song${selectedSongIds.size > 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>

          {/* Search input */}
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by title, artist, or album..."
            value={searchQuery}
            onChange={(e) => updateSearchQuery(e.target.value)}
          />

          {/* Song picker table */}
          <div className={styles.tableContainer}>
            {filteredSongs.length === 0 ? (
              <div className={styles.emptySection}>
                <p>{searchQuery ? 'No songs match your search.' : 'No songs in library.'}</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thCheckbox}></th>
                    <th>Title</th>
                    <th>Artist</th>
                    <th>Album</th>
                    <th className={styles.thStatus}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSongs.map(song => (
                    <PickerSongRow
                      key={song.id}
                      song={song}
                      isSelected={selectedSongIds.has(song.id)}
                      isInPlaylist={playlistSongIdSet.has(song.id)}
                      onToggle={toggleSongSelection}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && playlist && (
        <ConfirmModal
          title="Delete Playlist"
          message={`Are you sure you want to delete "${playlist.name}"? This will not delete the songs from your library.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
          isLoading={isDeleting}
        />
      )}

      {/* Rename modal */}
      {showRenameModal && playlist && (
        <ConfirmModal
          title="Rename Playlist"
          confirmLabel="Rename"
          variant="default"
          onConfirm={handleConfirmRename}
          onCancel={handleCancelRename}
          isLoading={isRenaming}
        >
          <div className={styles.renameForm}>
            <label htmlFor="rename-input" className={styles.renameLabel}>
              Playlist Name
            </label>
            <input
              id="rename-input"
              type="text"
              className={`${styles.renameInput} ${renameError ? styles.renameInputError : ''}`}
              value={newPlaylistName}
              onChange={handleRenameInputChange}
              placeholder="Enter playlist name"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isRenaming) {
                  handleConfirmRename();
                }
              }}
            />
            {renameError && (
              <span className={styles.renameErrorText}>{renameError}</span>
            )}
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}
