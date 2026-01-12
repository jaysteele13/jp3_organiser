/**
 * ArtistView Component
 * 
 * Displays artists in a full-width card list format.
 * Artist names are clickable links that navigate to the Player artist detail page.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardList } from '../../../../../components';

export default function ArtistView({ library, onDeleteArtist, onEditArtist }) {
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

  const handleTitleClick = useCallback((artist) => {
    navigate(`/player/artist/${artist.id}`);
  }, [navigate]);

  const getTitle = useCallback((artist) => artist.name, []);
  
  const getMeta = useCallback((artist) => {
    const counts = artistCounts[artist.id] || { songs: 0, albums: 0 };
    return [
      `${counts.albums} album(s)`,
      `${counts.songs} song(s)`,
    ];
  }, [artistCounts]);

  const getActions = useCallback((artist) => [
    { label: 'Edit Artist', onClick: () => onEditArtist?.(artist) },
    { label: 'Delete Artist', onClick: () => onDeleteArtist?.(artist), variant: 'danger' },
  ], [onEditArtist, onDeleteArtist]);

  return (
    <CardList
      items={library.artists}
      getTitle={getTitle}
      getMeta={getMeta}
      onTitleClick={handleTitleClick}
      getActions={getActions}
      emptyMessage="No artists in library"
    />
  );
}
