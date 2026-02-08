/**
 * ArtistDetail Page
 * 
 * Displays artist details using the reusable DetailView component.
 * Fetches artist data based on URL parameter.
 * 
 * Back navigation uses browser history to return to the previous page,
 * with a fallback to the Artists tab if accessed directly.
 */

import React, { useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLibraryConfig } from '../../../../hooks';
import { useLibrary } from '../../../../hooks/useLibrary';
import { LoadingState, ErrorState, EmptyState, CoverArt } from '../../../../components';
import DetailView from '../DetailView';
import { formatDuration } from '../../../../utils/formatters';
import { IMAGE_COVER_TYPE } from '../../../../utils/enums';

import { TABS } from '../../../../utils/enums';

export default function ArtistDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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


  // Render cover art with xlarge size - defined before early returns to follow Rules of Hooks
  const renderCoverArt = useCallback(() => (
    <CoverArt
      artist={artist?.name}
      libraryPath={libraryPath}
      size="xlarge"
      imageCoverType={IMAGE_COVER_TYPE.ARTIST}
      circular={false}
    />
  ), [artist?.name, libraryPath]);

  const handleBack = useCallback(() => {
    // If we have navigation history from within the app, go back
    // Otherwise fall back to the Artists tab
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate(`/player?tab=${TABS.ARTISTS}`);
    }
  }, [navigate, location.key]);

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
      renderCoverArt={renderCoverArt}
    />
  );
}
