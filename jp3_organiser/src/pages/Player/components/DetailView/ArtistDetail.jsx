/**
 * ArtistDetail Page
 * 
 * Displays artist details using the reusable DetailView component.
 * Fetches artist data based on URL parameter.
 */

import React, { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLibraryConfig } from '../../../../hooks';
import { useLibrary } from '../../../../hooks/useLibrary';
import { LoadingState, ErrorState, EmptyState } from '../../../../components';
import DetailView from '../DetailView';
import { formatDuration } from '../../../../utils/formatters';

export default function ArtistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { libraryPath } = useLibraryConfig();
  const { library, isLoading, error } = useLibrary(libraryPath);

  // Parse artist ID
  const artistId = parseInt(id, 10);

  // Find artist and their songs
  const artist = useMemo(() => {
    if (!library?.artists) return null;
    return library.artists.find(a => a.id === artistId);
  }, [library, artistId]);

  const artistSongs = useMemo(() => {
    if (!library?.songs || !artist) return [];
    return library.songs
      .filter(s => s.artistId === artistId)
      .sort((a, b) => {
        // Sort by album then track number
        if (a.albumName !== b.albumName) {
          return (a.albumName || '').localeCompare(b.albumName || '');
        }
        return (a.trackNumber || 0) - (b.trackNumber || 0);
      });
  }, [library, artistId, artist]);

  // Count unique albums
  const albumCount = useMemo(() => {
    const albumIds = new Set(artistSongs.map(s => s.albumId).filter(Boolean));
    return albumIds.size;
  }, [artistSongs]);

  // Calculate total duration
  const totalDuration = useMemo(() => {
    const totalSecs = artistSongs.reduce((sum, s) => sum + (s.durationSec || 0), 0);
    return totalSecs > 0 ? formatDuration(totalSecs) : null;
  }, [artistSongs]);

  const handleBack = () => {
    navigate('/player');
  };

  if (isLoading) {
    return <LoadingState message="Loading artist..." />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!artist) {
    return (
      <EmptyState
        title="Artist Not Found"
        message="The artist you're looking for doesn't exist."
      />
    );
  }

  // Build metadata string
  const meta = [
    `${albumCount} ${albumCount === 1 ? 'album' : 'albums'}`,
    `${artistSongs.length} songs`,
    totalDuration
  ].filter(Boolean).join(' • ');

  return (
    <DetailView
      type="artist"
      itemId={artistId}
      title={artist.name}
      subtitle=""
      meta={meta}
      songs={artistSongs}
      onBack={handleBack}
    />
  );
}
