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
 */

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SongTable, ActionMenu } from '../../../../../components';
import { TABS } from '../../../../../utils/enums';
import styles from './SongView.module.css';

export default function SongView({ library, onDeleteSong, onEditSong, songFilter, onClearFilter }) {
  const navigate = useNavigate();

  // Filter songs if a filter is active
  const displaySongs = useMemo(() => {
    if (!songFilter) {
      return library.songs;
    }
    // Filter to only show the selected song (by ID for exact match)
    return library.songs.filter(song => song.id === songFilter.id);
  }, [library.songs, songFilter]);

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

  return (
    <div className={styles.container}>
      {/* Filter indicator bar */}
      {songFilter && (
        <div className={styles.filterBar}>
          <span className={styles.filterText}>
            Showing: <strong>{songFilter.title}</strong> by {songFilter.artistName}
          </span>
          <button 
            className={styles.clearButton}
            onClick={onClearFilter}
            type="button"
          >
            Show all songs
          </button>
        </div>
      )}
      
      <SongTable
        songs={displaySongs}
        variant="table"
        columns={['title', 'artist', 'album', 'path']}
        onTitleClick={handleTitleClick}
        onArtistClick={handleArtistClick}
        onAlbumClick={handleAlbumClick}
        renderActions={renderActions}
        emptyMessage="No songs in library"
      />
    </div>
  );
}
