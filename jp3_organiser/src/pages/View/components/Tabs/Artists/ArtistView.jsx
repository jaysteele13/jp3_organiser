/**
 * ArtistView Component
 * 
 * Displays artists in a circle-centric grid layout.
 * Each artist shows as a circular image with name below.
 * On hover, shows album/song count and action menu.
 * Artist names are clickable links that navigate to the Player artist detail page.
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

  const handleArtistClick = useCallback((artist) => {
    navigate(`/player/artist/${artist.id}`);
  }, [navigate]);

  const getActions = useCallback((artist) => [
    { label: 'Edit Artist', onClick: () => onEditArtist?.(artist) },
    { label: 'Delete Artist', onClick: () => onDeleteArtist?.(artist), variant: 'danger' },
  ], [onEditArtist, onDeleteArtist]);

  return (
    <ArtistGrid
      artists={library.artists}
      libraryPath={libraryPath}
      artistCounts={artistCounts}
      onArtistClick={handleArtistClick}
      getActions={getActions}
      emptyMessage="No artists in library"
    />
  );
}
