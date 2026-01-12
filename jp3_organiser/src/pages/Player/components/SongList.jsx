/**
 * SongList Component
 * 
 * Displays a list of songs with Play (click row) and Queue actions.
 * Uses the shared SongTable component with PlayerSongCard for consistent
 * player experience (clickable artist/album links with built-in navigation).
 */

import React, { useCallback } from 'react';
import { usePlayer } from '../../../hooks';
import { SongTable } from '../../../components';
import PlayerSongCard from './PlayerSongCard';

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

  // Render each song using PlayerSongCard (has built-in navigation)
  const renderCard = useCallback((song, { isHighlighted }) => (
    <PlayerSongCard
      song={song}
      isPlaying={isHighlighted}
      onPlay={handlePlay}
      onQueue={handleQueue}
    />
  ), [handlePlay, handleQueue]);

  return (
    <SongTable
      songs={songs}
      variant="card"
      highlightId={currentTrackId}
      renderCard={renderCard}
      emptyMessage="No songs in library"
      noResultsMessage="No songs match your search"
      searchPlaceholder="Search songs..."
    />
  );
}
