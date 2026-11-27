/**
 * SongList Component
 * 
 * Displays a list of songs with Play (click row) and Queue actions.
 * Uses the shared SongTable component with PlayerSongCard for consistent
 * player experience (clickable artist/album links with built-in navigation).
 */

import React, { useCallback, useMemo } from 'react';
import { usePlayer, useTextFilter } from '../../../hooks';
import { shuffleArray } from '../../../hooks/player/playerUtils';
import { filterSongsByText } from '../../../utils/songFilter';
import { SongTable, QueryFilterBar } from '../../../components';
import { TABS } from '../../../utils/enums';
import PlayerSongCard from './PlayerSongCard';
import styles from './SongList.module.css';

export default function SongList({ songs: allSongs }) {
  const { playTrack, addToQueue, isCurrentTrack } = usePlayer();
  const [textFilter] = useTextFilter();
  const songs = useMemo(() => filterSongsByText(allSongs, textFilter), [allSongs, textFilter]);

  const handlePlayAll = useCallback(() => {
    if (songs.length > 0) {
      playTrack(songs[0], songs);
    }
  }, [playTrack, songs]);

  const handleShuffle = useCallback(() => {
    if (songs.length > 0) {
      const shuffled = shuffleArray(songs);
      playTrack(shuffled[0], shuffled);
    }
  }, [playTrack, songs]);



  const handlePlay = useCallback((song) => {
    playTrack(song, songs);
  }, [playTrack, songs]);

  const handleQueue = useCallback((song) => {
    addToQueue(song);
  }, [addToQueue]);

  const currentTrackId = songs.find(s => isCurrentTrack(s.id))?.id;

  const renderCard = useCallback((song, { isHighlighted }) => (
    <PlayerSongCard
      song={song}
      isPlaying={isHighlighted}
      onPlay={handlePlay}
      onQueue={handleQueue}
    />
  ), [handlePlay, handleQueue]);

  return (
    <div className={styles.container}>
      <QueryFilterBar tab={TABS.SONGS} clearText="Show all songs" />
      <div className={styles.actions}>
        <button
          className={`${styles.actionBtn} ${styles.primary}`}
          onClick={handlePlayAll}
          disabled={songs.length === 0}
        >
          Play
        </button>
        <button
          className={`${styles.actionBtn} ${styles.secondary}`}
          onClick={handleShuffle}
          disabled={songs.length === 0}
        >
          Shuffle
        </button>
      </div>
      <SongTable
        songs={songs}
        variant="card"
        highlightId={currentTrackId}
        renderCard={renderCard}
        emptyMessage={textFilter ? 'No songs match your search' : 'No songs in library'}
        noResultsMessage="No songs match your search"
        searchPlaceholder="Search songs..."
      />
    </div>
  );
}
