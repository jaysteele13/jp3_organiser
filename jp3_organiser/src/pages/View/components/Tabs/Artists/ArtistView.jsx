/**
 * ArtistView Component
 * 
 * Displays artists in a circle-centric grid layout.
 * Each artist shows as a circular image with name below.
 * Clicking an artist reveals an overlay with album/song count and action menu.
 * "Go to Artist" action navigates to the Player artist detail page.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArtistGrid } from '../../../../../components';


export default function ArtistView({ library, libraryPath, onDeleteArtist, onEditArtist }) {
  const navigate = useNavigate();

  // Pre-compute song and album counts for each artist
  const artistCounts = useMemo(() => {
    const counts = {};
    library.artists.forEach(artist => {
      counts[artist.id] = { songs: 0, albums: 0 };
    });
    library.songs.forEach(song => {
      if (counts[song.artistId]) {
        counts[song.artistId].songs++;
      }
    });
    library.albums.forEach(album => {
      if (counts[album.artistId]) {
        counts[album.artistId].albums++;
      }
    });
    return counts;
  }, [library.artists, library.songs, library.albums]);

  const getActions = useCallback((artist) => [
    { label: 'Go to Artist', onClick: () => navigate(`/player/artist/${artist.id}`) },
    { label: 'Edit Artist', onClick: () => onEditArtist?.(artist) },
    { label: 'Delete Artist', onClick: () => onDeleteArtist?.(artist), variant: 'danger' },
  ], [navigate, onEditArtist, onDeleteArtist]);

  return (
    <ArtistGrid
      artists={library.artists}
      libraryPath={libraryPath}
      artistCounts={artistCounts}
      getActions={getActions}
      emptyMessage="No artists in library"
    />
  );
}
