/**
 * SongView Component
 * 
 * Displays all songs in the library with search, pagination, and actions.
 * Uses the shared SongTable component with table variant.
 */

import { useCallback } from 'react';
import { SongTable, ActionMenu } from '../../../../../components';

export default function SongView({ library, onDeleteSong, onEditSong }) {
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
      columns={['title', 'artist', 'album', 'duration', 'path']}
      renderActions={renderActions}
      emptyMessage="No songs in library"
      noResultsMessage="No songs match your search"
      searchPlaceholder="Search songs by title, artist, or album..."
    />
  );
}
