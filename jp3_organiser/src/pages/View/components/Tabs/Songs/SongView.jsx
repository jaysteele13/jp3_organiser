/**
 * SongView Component
 * 
 * Displays all songs in the library with search, pagination, and actions.
 * Uses the shared SongTable component with table variant.
 * Title, artist, and album names are clickable links that navigate to Player.
 * Clicking a song title navigates to Player and begins playback.
 */

import { useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SongTable, ActionMenu } from '../../../../../components';
import { TABS } from '../../../../../utils/enums';

export default function SongView({ library, onDeleteSong, onEditSong, searchFilter, onFilterClear }) {
  const navigate = useNavigate();
  
  // Track the externally-set filter to detect when user manually changes search
  const externalFilterRef = useRef(searchFilter);
  
  // Update ref when external filter changes
  if (searchFilter !== externalFilterRef.current) {
    externalFilterRef.current = searchFilter;
  }
  
  // Create initial state for SongTable based on external search filter
  const initialState = useMemo(() => {
    if (!searchFilter) return undefined;
    return { searchQuery: searchFilter };
  }, [searchFilter]);
  
  // Handle state changes from SongTable - clear external filter when user modifies search
  const handleStateChange = useCallback((state) => {
    // If user changed the search query from what we set externally, clear the filter
    if (externalFilterRef.current && state.searchQuery !== externalFilterRef.current) {
      onFilterClear?.();
      externalFilterRef.current = '';
    }
  }, [onFilterClear]);

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

  // Render action menu for each song row
  const renderActions = useCallback((song) => (
    <ActionMenu
      items={[
        { label: 'Edit', onClick: () => onEditSong?.(song) },
        { label: 'Delete', onClick: () => onDeleteSong?.(song), variant: 'danger' },
      ]}
    />
  ), [onEditSong, onDeleteSong]);

  // Generate a key to force SongTable remount when external filter changes
  // This ensures the initialState is applied when user clicks a song from LibrarySearch
  const tableKey = useMemo(() => {
    return searchFilter ? `filter-${searchFilter}` : 'default';
  }, [searchFilter]);

  return (
    <SongTable
      key={tableKey}
      songs={library.songs}
      variant="table"
      columns={['title', 'artist', 'album', 'path']}
      onTitleClick={handleTitleClick}
      onArtistClick={handleArtistClick}
      onAlbumClick={handleAlbumClick}
      renderActions={renderActions}
      emptyMessage="No songs in library"
      noResultsMessage="No songs match your search"
      searchPlaceholder="Search songs by title, artist, or album..."
      initialState={initialState}
      onStateChange={handleStateChange}
    />
  );
}
