/**
 * ArtistList Component
 * 
 * Displays artists as circular cards in a grid layout using ArtistGrid.
 * Clicking a card navigates directly to the artist detail page.
 * Right-click shows context menu with "View in Library" option.
 * Uses quaternary (purple) color scheme with xlarge cover art.
 */

import { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArtistGrid } from '../../../components';
import { TABS } from '../../../utils/enums';

export default function ArtistList({ artists, songs, libraryPath }) {
  const navigate = useNavigate();

  // Build artistCounts map for ArtistGrid: { artistId: { albums, songs } }
  const artistCounts = useMemo(() => {
    const albumSets = {};
    const songCounts = {};
    
    songs.forEach(song => {
      // Count songs
      songCounts[song.artistId] = (songCounts[song.artistId] || 0) + 1;
      
      // Track unique albums
      if (!albumSets[song.artistId]) {
        albumSets[song.artistId] = new Set();
      }
      if (song.albumId) {
        albumSets[song.artistId].add(song.albumId);
      }
    });

    const counts = {};
    artists.forEach(artist => {
      counts[artist.id] = {
        albums: albumSets[artist.id]?.size || 0,
        songs: songCounts[artist.id] || 0,
      };
    });
    return counts;
  }, [songs, artists]);

  // Navigate directly to artist page on click
  const handleArtistClick = useCallback((artist) => {
    navigate(`/player/artist/${artist.id}`);
  }, [navigate]);

  // Navigate to View page with artist filter
  const handleViewInLibrary = useCallback((artist) => {
    navigate('/view', { 
      state: { 
        tab: TABS.ARTISTS,
        filterArtist: artist,
        fromPlayer: true
      } 
    });
  }, [navigate]);

  return (
    <ArtistGrid
      artists={artists}
      libraryPath={libraryPath}
      artistCounts={artistCounts}
      onArtistClick={handleArtistClick}
      onViewInLibrary={handleViewInLibrary}
      cardSize={250}
      coverSize="xlarge"
      variant="purple"
      emptyMessage="No artists in library"
    />
  );
}
