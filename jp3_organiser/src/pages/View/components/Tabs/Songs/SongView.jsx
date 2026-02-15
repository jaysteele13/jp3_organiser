/**
 * SongView Component
 * 
 * Displays all songs in the library with pagination and actions.
 * Uses the shared SongTable component with table variant.
 * Title, artist, and album names are clickable links that navigate to Player.
 * Clicking a song title navigates to Player and begins playback.
 * 
 * Supports external filtering via songFilter prop (from LibrarySearch).
 * When a filter is active, shows only the filtered song with a clear button.
 * 
 * Supports multiselect mode for bulk deletion via checkbox column.
 * Select mode is toggled via a button above the table.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SongTable, ActionMenu, FilterBar } from '../../../../../components';
import { useMultiSelect } from '../../../../../hooks';
import { TABS } from '../../../../../utils/enums';
import { load } from '@tauri-apps/plugin-store';
import styles from './SongView.module.css';

const STORE_NAME = 'songview.json';
const SORT_KEY = 'songSortIndex';

const SORT_OPTIONS = [
  { field: 'id', direction: 'asc', label: 'Oldest' },
  { field: 'id', direction: 'desc', label: 'Newest' },
  { field: 'title', direction: 'asc', label: 'A-Z' },
  { field: 'title', direction: 'desc', label: 'Z-A' },
];

async function getStoredSortIndex() {
  try {
    const store = await load(STORE_NAME, { autoSave: true });
    const index = await store.get(SORT_KEY);
    return typeof index === 'number' ? index : 0;
  } catch (error) {
    console.error('Failed to load sort preference:', error);
    return 0;
  }
}

async function setStoredSortIndex(index) {
  try {
    const store = await load(STORE_NAME, { autoSave: true });
    await store.set(SORT_KEY, index);
  } catch (error) {
    console.error('Failed to save sort preference:', error);
  }
}

export default function SongView({ library, onDeleteSong, onDeleteSongs, onEditSong, songFilter, onClearFilter }) {
  const navigate = useNavigate();

  // Select mode toggle state
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Sort state - load from persistent storage
  const [sortIndex, setSortIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved sort index on mount
  useEffect(() => {
    getStoredSortIndex().then((index) => {
      setSortIndex(index);
      setIsLoaded(true);
    });
  }, []);

  // Current sort option
  const currentSort = SORT_OPTIONS[sortIndex];

  // Toggle sort option and persist
  const handleToggleSort = useCallback(() => {
    setSortIndex((prev) => {
      const next = (prev + 1) % SORT_OPTIONS.length;
      setStoredSortIndex(next);
      return next;
    });
  }, []);

  // Filter songs if a filter is active
  const displaySongs = useMemo(() => {
    if (!isLoaded) return library.songs;

    let songs = songFilter
      ? library.songs.filter(song => song.id === songFilter.id)
      : library.songs;

    // Apply sorting
    const { field, direction } = currentSort;
    songs = [...songs].sort((a, b) => {
      let comparison = 0;
      if (field === 'id') {
        comparison = a.id - b.id;
      } else if (field === 'title') {
        const aTitle = (a.title || '').toLowerCase();
        const bTitle = (b.title || '').toLowerCase();
        comparison = aTitle.localeCompare(bTitle);
      }
      return direction === 'desc' ? -comparison : comparison;
    });

    return songs;
  }, [library.songs, songFilter, currentSort, isLoaded]);

  // Multiselect state
  const {
    selectedItems,
    selectedCount,
    allSelected,
    someSelected,
    hasSelection,
    toggleItem,
    selectAll,
    deselectAll,
    isSelected,
  } = useMultiSelect(displaySongs);

  // Clear selection when filter changes or select mode is disabled
  useEffect(() => {
    deselectAll();
  }, [songFilter, deselectAll]);

  // Exit select mode handler - clears selection and disables mode
  const handleExitSelectMode = useCallback(() => {
    deselectAll();
    setIsSelectMode(false);
  }, [deselectAll]);

  // Toggle select mode
  const handleToggleSelectMode = useCallback(() => {
    if (isSelectMode) {
      handleExitSelectMode();
    } else {
      setIsSelectMode(true);
    }
  }, [isSelectMode, handleExitSelectMode]);

  const handleTitleClick = useCallback((song) => {
    // Navigate to Player with song data to trigger playback
    navigate(`/player?tab=${TABS.SONGS}`, { 
      state: { 
        playSong: song,
        playContext: library.songs // Provide all songs as context for next/prev
      } 
    });
  }, [navigate, library.songs]);

  const handleArtistClick = useCallback((artistId) => {
    navigate(`/player/artist/${artistId}`);
  }, [navigate]);

  const handleAlbumClick = useCallback((albumId) => {
    navigate(`/player/album/${albumId}`);
  }, [navigate]);

  // Handle bulk delete
  const handleDeleteSelected = useCallback(() => {
    if (selectedItems.length > 0 && onDeleteSongs) {
      onDeleteSongs(selectedItems);
      handleExitSelectMode();
    }
  }, [selectedItems, onDeleteSongs, handleExitSelectMode]);

  // Handle select all checkbox toggle
  const handleSelectAllToggle = useCallback(() => {
    if (allSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [allSelected, deselectAll, selectAll]);

  // Handle individual checkbox toggle (with shift+click support)
  const handleCheckboxToggle = useCallback((song, index, event) => {
    toggleItem(song.id, index, event?.shiftKey);
  }, [toggleItem]);

  // Render action menu for each song row
  const renderActions = useCallback((song) => (
    <ActionMenu
      items={[
        { label: 'Edit', onClick: () => onEditSong?.(song) },
        { label: 'Delete', onClick: () => onDeleteSong?.(song), variant: 'danger' },
      ]}
    />
  ), [onEditSong, onDeleteSong]);

  const isEmpty = library.songs.length > 0;

  return (
    <div className={styles.container}>
      {/* Filter indicator bar */}
      {songFilter && (
        <FilterBar
          label={songFilter.title}
          sublabel={`by ${songFilter.artistName}`}
          onClear={onClearFilter}
          clearText="Show all songs"
        />
      )}

      {/* Toolbar row - Select mode toggle and selection actions */}
      <div className={styles.toolbar}>
        { isEmpty && (
          <div className={styles.toolbarLeft}>
            <button
              type="button"
              className={styles.sortBtn}
              onClick={handleToggleSort}
              title="Change sort order"
            >
              Sort: {currentSort.label}
            </button>
            <button
              type="button"
              className={`${styles.selectModeBtn} ${isSelectMode ? styles.selectModeActive : ''}`}
              onClick={handleToggleSelectMode}
              aria-pressed={isSelectMode}
            >
              {isSelectMode ? 'Cancel' : 'Select'}
            </button>
          </div>
        )}
     

        {/* Selection actions - shown when in select mode with items selected */}
        {isSelectMode && hasSelection && (
          <div className={styles.selectionInfo}>
            <span className={styles.selectionCount}>
              {selectedCount} selected
            </span>
            <button
              type="button"
              className={styles.deleteSelectedBtn}
              onClick={handleDeleteSelected}
            >
              Delete
            </button>
          </div>
        )}
      </div>
      
      <SongTable
        songs={displaySongs}
        variant="table"
        columns={['title', 'artist', 'album', 'path']}
        onTitleClick={handleTitleClick}
        onArtistClick={handleArtistClick}
        onAlbumClick={handleAlbumClick}
        renderActions={renderActions}
        emptyMessage="No songs in library"
        // Multiselect props - only show checkboxes when in select mode
        showCheckboxes={isSelectMode}
        isSelected={isSelected}
        onCheckboxToggle={handleCheckboxToggle}
        allSelected={allSelected}
        someSelected={someSelected}
        onSelectAllToggle={handleSelectAllToggle}
      />
    </div>
  );
}
