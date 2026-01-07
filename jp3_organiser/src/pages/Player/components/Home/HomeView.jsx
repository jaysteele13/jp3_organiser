/**
 * HomeView Component
 * 
 * Clean home page with two focused sections:
 * 1. Recently Played - Albums, artists, playlists, and songs the user has played
 * 2. Recently Added - Newest songs in the library (sorted by ID descending)
 * 
 * Props:
 * - library: object - library data containing songs, albums, artists, playlists
 */

import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer, useRecents, RECENT_TYPE } from '../../../../hooks';
import { addToRecents } from '../../../../services/recentsService';
import { EmptyState } from '../../../../components';
import SectionHeader from './SectionHeader';
import SongPreview from './SongPreview';
import RecentRow from './RecentRow';
import styles from './HomeView.module.css';

// Number of items to show in each section
const RECENTLY_PLAYED_LIMIT = 6;
const RECENTLY_ADDED_LIMIT = 8;

export default function HomeView({ library }) {
  const navigate = useNavigate();
  const { playTrack, addToQueue, isCurrentTrack } = usePlayer();

  // Get library data
  const songs = library?.songs || [];
  const albums = library?.albums || [];
  const artists = library?.artists || [];
  const playlists = library?.playlists || [];

  // Get recently played items (mixed content)
  const { recentItems, hasRecents } = useRecents(library);

  // Get recently added songs (highest IDs = most recently added)
  const recentlyAddedSongs = useMemo(() => {
    if (!songs.length) return [];
    
    return [...songs]
      .sort((a, b) => b.id - a.id)
      .slice(0, RECENTLY_ADDED_LIMIT);
  }, [songs]);

  // Check if library is empty
  const isLibraryEmpty = songs.length === 0;

  // Play handlers for different content types
  const handlePlaySong = useCallback((song) => {
    playTrack(song, songs);
    // Song recents are tracked in usePlayerContext
  }, [playTrack, songs]);

  const handlePlayAlbum = useCallback((album) => {
    const albumSongs = songs
      .filter(s => s.albumId === album.id)
      .sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
    if (albumSongs.length > 0) {
      playTrack(albumSongs[0], albumSongs);
      // Track album in recents
      addToRecents(RECENT_TYPE.ALBUM, album.id);
    }
  }, [songs, playTrack]);

  const handlePlayArtist = useCallback((artist) => {
    const artistSongs = songs.filter(s => s.artistId === artist.id);
    if (artistSongs.length > 0) {
      playTrack(artistSongs[0], artistSongs);
      // Track artist in recents
      addToRecents(RECENT_TYPE.ARTIST, artist.id);
    }
  }, [songs, playTrack]);

  const handlePlayPlaylist = useCallback((playlist) => {
    const playlistSongs = (playlist.songIds || [])
      .map(id => songs.find(s => s.id === id))
      .filter(Boolean);
    if (playlistSongs.length > 0) {
      playTrack(playlistSongs[0], playlistSongs);
      // Track playlist in recents
      addToRecents(RECENT_TYPE.PLAYLIST, playlist.id);
    }
  }, [songs, playTrack]);

  // Navigate to detail view
  const handleNavigate = useCallback((type, item) => {
    switch (type) {
      case RECENT_TYPE.ALBUM:
        navigate(`/player/album/${item.id}`);
        break;
      case RECENT_TYPE.ARTIST:
        navigate(`/player/artist/${item.id}`);
        break;
      case RECENT_TYPE.PLAYLIST:
        navigate(`/player/playlist/${item.id}`);
        break;
    }
  }, [navigate]);

  const handleQueueSong = useCallback((song) => {
    addToQueue(song);
  }, [addToQueue]);

  if (isLibraryEmpty) {
    return (
      <EmptyState
        title="Your Library is Empty"
        message="Upload songs to get started and they'll appear here."
      />
    );
  }

  return (
    <div className={styles.container}>
      {/* Welcome Header */}
      <div className={styles.welcomeHeader}>
        <h1 className={styles.welcomeTitle}>Welcome Back</h1>
        <p className={styles.welcomeSubtitle}>
          {songs.length} songs in your library
        </p>
      </div>

      {/* Recently Played Section */}
      {hasRecents && (
        <section className={styles.section}>
          <SectionHeader
            title="Recently Played"
            count={Math.min(recentItems.length, RECENTLY_PLAYED_LIMIT)}
          />
          <RecentRow
            items={recentItems.slice(0, RECENTLY_PLAYED_LIMIT)}
            onPlaySong={handlePlaySong}
            onPlayAlbum={handlePlayAlbum}
            onPlayArtist={handlePlayArtist}
            onPlayPlaylist={handlePlayPlaylist}
            onNavigate={handleNavigate}
          />
        </section>
      )}

      {/* Recently Added Section */}
      <section className={styles.section}>
        <SectionHeader
          title="Recently Added"
          count={recentlyAddedSongs.length}
        />
        <SongPreview
          songs={recentlyAddedSongs}
          limit={RECENTLY_ADDED_LIMIT}
          onPlay={handlePlaySong}
          onQueue={handleQueueSong}
          isCurrentTrack={isCurrentTrack}
        />
      </section>
    </div>
  );
}
