/**
 * ArtistView Component
 * 
 * Displays artists in a circle-centric grid layout.
 * Each artist shows as a circular image with name below.
 * Clicking an artist reveals an overlay with album/song count and action menu.
 * "Go to Artist" action navigates to the Player artist detail page.
 * 
 * Supports filtering via filter prop (from LibrarySearch).
 * When filtered, shows only the selected artist.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArtistGrid, FilterBar } from '../../../../../components';
import styles from './ArtistView.module.css';


export default function ArtistView({ library, libraryPath, onDeleteArtist, onEditArtist, filter, onClearFilter }) {
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

  // Filter artists if a filter is active
  const displayArtists = useMemo(() => {
    if (!filter) {
      return library.artists;
    }
    return library.artists.filter(artist => artist.id === filter.id);
  }, [library.artists, filter]);

  const getActions = useCallback((artist) => [
    { label: 'Go to Artist', onClick: () => navigate(`/player/artist/${artist.id}`) },
    { label: 'Edit Artist', onClick: () => onEditArtist?.(artist) },
    { label: 'Delete Artist', onClick: () => onDeleteArtist?.(artist), variant: 'danger' },
  ], [navigate, onEditArtist, onDeleteArtist]);

  return (
    <div className={styles.container}>
      {filter && (
        <FilterBar
          label={filter.name}
          onClear={onClearFilter}
          clearText="Show all artists"
        />
      )}
      <ArtistGrid
        artists={displayArtists}
        libraryPath={libraryPath}
        artistCounts={artistCounts}
        getActions={getActions}
        emptyMessage="No artists in library"
      />
    </div>
  );
}
