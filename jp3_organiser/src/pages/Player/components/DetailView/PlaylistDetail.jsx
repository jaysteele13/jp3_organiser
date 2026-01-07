/**
 * PlaylistDetail Page
 * 
 * Displays playlist details using the reusable DetailView component.
 * Fetches playlist data based on URL parameter.
 */

import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLibraryConfig } from '../../../../hooks';
import { useLibrary } from '../../../../hooks/useLibrary';
import { LoadingState, ErrorState, EmptyState } from '../../../../components';
import DetailView from '../DetailView';
import { formatDuration } from '../../../../utils/formatters';

export default function PlaylistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { libraryPath } = useLibraryConfig();
  const { library, isLoading, error } = useLibrary(libraryPath);

  // Parse playlist ID
  const playlistId = parseInt(id, 10);

  // Find playlist
  const playlist = useMemo(() => {
    if (!library?.playlists) return null;
    return library.playlists.find(p => p.id === playlistId);
  }, [library, playlistId]);

  // Build song map for quick lookup
  const songMap = useMemo(() => {
    if (!library?.songs) return {};
    const map = {};
    library.songs.forEach(song => {
      map[song.id] = song;
    });
    return map;
  }, [library]);

  // Get playlist songs in order
  const playlistSongs = useMemo(() => {
    if (!playlist?.songIds) return [];
    return playlist.songIds
      .map(id => songMap[id])
      .filter(Boolean);
  }, [playlist, songMap]);

  // Calculate total duration
  const totalDuration = useMemo(() => {
    const totalSecs = playlistSongs.reduce((sum, s) => sum + (s.durationSec || 0), 0);
    return totalSecs > 0 ? formatDuration(totalSecs) : null;
  }, [playlistSongs]);

  const handleBack = () => {
    navigate('/player');
  };

  if (isLoading) {
    return <LoadingState message="Loading playlist..." />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!playlist) {
    return (
      <EmptyState
        title="Playlist Not Found"
        message="The playlist you're looking for doesn't exist."
      />
    );
  }

  // Build metadata string
  const meta = [
    `${playlistSongs.length} songs`,
    totalDuration
  ].filter(Boolean).join(' • ');

  return (
    <DetailView
      type="playlist"
      title={playlist.name}
      subtitle=""
      meta={meta}
      songs={playlistSongs}
      onBack={handleBack}
    />
  );
}
