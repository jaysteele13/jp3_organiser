/**
 * AlbumDetail Page
 * 
 * Displays album details using the reusable DetailView component.
 * Fetches album data based on URL parameter.
 * 
 * Back navigation uses browser history to return to the previous page,
 * with a fallback to the Albums tab if accessed directly.
 */

import React, { useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLibraryConfig } from '../../../../hooks';
import { useLibrary } from '../../../../hooks/useLibrary';
import { LoadingState, ErrorState, EmptyState } from '../../../../components';
import DetailView from '../DetailView';
import { formatDuration } from '../../../../utils/formatters';
import { TABS } from '../../../../utils/enums';

export default function AlbumDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { libraryPath } = useLibraryConfig();
  const { library, isLoading, error } = useLibrary(libraryPath);

  // Parse album ID
  const albumId = parseInt(id, 10);

  // Find album and its songs
  const album = useMemo(() => {
    if (!library?.albums) return null;
    return library.albums.find(a => a.id === albumId);
  }, [library, albumId]);

  const albumSongs = useMemo(() => {
    if (!library?.songs || !album) return [];
    return library.songs
      .filter(s => s.albumId === albumId)
      .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
  }, [library, albumId, album]);

  // Calculate total duration
  const totalDuration = useMemo(() => {
    const totalSecs = albumSongs.reduce((sum, s) => sum + (s.durationSec || 0), 0);
    return totalSecs > 0 ? formatDuration(totalSecs) : null;
  }, [albumSongs]);

  const handleBack = useCallback(() => {
    // If we have navigation history from within the app, go back
    // Otherwise fall back to the Albums tab
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(`/player?tab=${TABS.ALBUMS}`);
    }
  }, [navigate, location.key]);

  if (isLoading) {
    return <LoadingState message="Loading album..." />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!album) {
    return (
      <EmptyState
        title="Album Not Found"
        message="The album you're looking for doesn't exist."
      />
    );
  }

  // Build metadata string
  const meta = [
    album.year,
    `${albumSongs.length} songs`,
    totalDuration
  ].filter(Boolean).join(' • ');

  return (
    <DetailView
      type="album"
      itemId={albumId}
      title={album.name}
      subtitle={album.artistName}
      meta={meta}
      songs={albumSongs}
      onBack={handleBack}
    />
  );
}
