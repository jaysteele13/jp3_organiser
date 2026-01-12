/**
 * SongList Component
 * 
 * Displays a list of songs with Play (click row) and Queue actions.
 * Uses the shared SongTable component with card variant.
 */

import React, { useCallback } from 'react';
import { usePlayer } from '../../../hooks';
import { SongTable } from '../../../components';
import styles from './ListStyles.module.css';

export default function SongList({ songs }) {
  const { playTrack, addToQueue, isCurrentTrack } = usePlayer();

  const handlePlay = useCallback((song) => {
    // Play this song within the context of all songs (enables next/prev)
    playTrack(song, songs);
  }, [playTrack, songs]);

  const handleQueue = useCallback((song) => {
    addToQueue(song);
  }, [addToQueue]);

  // Find currently playing track ID
  const currentTrackId = songs.find(s => isCurrentTrack(s.id))?.id;

  // Render queue button for each song
  const renderActions = useCallback((song) => (
    <button
      className={`${styles.actionBtn} ${styles.queue}`}
      onClick={(e) => {
        e.stopPropagation();
        handleQueue(song);
      }}
    >
      Queue
    </button>
  ), [handleQueue]);

  return (
    <SongTable
      songs={songs}
      variant="card"
      onRowClick={handlePlay}
      highlightId={currentTrackId}
      renderActions={renderActions}
      emptyMessage="No songs in library"
      noResultsMessage="No songs match your search"
      searchPlaceholder="Search songs..."
    />
  );
}
