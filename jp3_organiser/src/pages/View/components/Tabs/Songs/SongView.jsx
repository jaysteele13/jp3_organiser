/**
 * SongView Component
 * 
 * Displays all songs in the library with search, pagination, and actions.
 * Uses the shared SongTable component with table variant.
 * Title, artist, and album names are clickable links that navigate to Player.
 * Clicking a song title navigates to Player and begins playback.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SongTable, ActionMenu } from '../../../../../components';
import { TABS } from '../../../../../utils/enums';

export default function SongView({ library, onDeleteSong, onEditSong }) {
  const navigate = useNavigate();

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
    <SongTable
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
    />
  );
}
