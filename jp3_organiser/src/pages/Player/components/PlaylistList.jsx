/**
 * PlaylistList Component
 * 
 * Displays playlists as cards in a flex grid layout.
 * Clicking a card navigates to the playlist detail page.
 * Right-click shows context menu with "View in Library" option.
 * Uses secondary (lime) color scheme.
 */

import React, { useMemo, useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../../hooks';
import { ContextMenu } from '../../../components';
import { addToRecents, RECENT_TYPE } from '../../../services/recentsService';
import { TABS } from '../../../utils/enums';
import styles from './ListStyles.module.css';

const COLOR_VARIANTS = ['color1', 'color2', 'color3'];

const getColorVariant = (index) => {
  return COLOR_VARIANTS[index % COLOR_VARIANTS.length];
};

/**
 * Individual playlist card with context menu support
 */
const PlaylistCard = memo(function PlaylistCard({
  playlist,
  playlistSongs,
  cardColor,
  onCardClick,
  onPlayPlaylist,
  onQueuePlaylist,
  onViewInLibrary
}) {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  return (
    <>
      <div
        className={`${styles.card} ${styles.playlistCard} ${styles[cardColor]}`}
        onClick={() => onCardClick(playlist)}
        onContextMenu={handleContextMenu}
      >
        <span className={styles.cardTitle}>{playlist.name}</span>
        <span className={styles.cardMeta}>
          {playlistSongs.length} songs
        </span>
        <div className={styles.cardActions}>
          <button
            className={styles.cardBtn}
            onClick={(e) => onPlayPlaylist(playlist, e)}
            disabled={playlistSongs.length === 0}
          >
            Play
          </button>
          <button
            className={`${styles.cardBtn} ${styles.queue}`}
            onClick={(e) => onQueuePlaylist(playlist, e)}
            disabled={playlistSongs.length === 0}
          >
            Queue
          </button>
        </div>
      </div>
      
      <ContextMenu
        visible={contextMenu.visible}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        items={[
          { label: 'View in Library', onClick: () => onViewInLibrary(playlist) }
        ]}
        onClose={closeContextMenu}
      />
    </>
  );
});

export default function PlaylistList({ playlists, songs }) {
  const navigate = useNavigate();
  const { playTrack, addToQueue } = usePlayer();

  // Create a map of song ID to song object for quick lookup
  const songMap = useMemo(() => {
    const map = {};
    songs.forEach(song => {
      map[song.id] = song;
    });
    return map;
  }, [songs]);

  // Get songs for a playlist by songIds
  const getPlaylistSongs = (playlist) => {
    if (!playlist.songIds) return [];
    return playlist.songIds
      .map(id => songMap[id])
      .filter(Boolean);
  };

  if (playlists.length === 0) {
    return <div className={styles.empty}>No playlists in library</div>;
  }

  const handleCardClick = (playlist) => {
    navigate(`/player/playlist/${playlist.id}`);
  };

  const handlePlayPlaylist = (playlist, e) => {
    e.stopPropagation();
    const playlistSongs = getPlaylistSongs(playlist);
    if (playlistSongs.length > 0) {
      playTrack(playlistSongs[0], playlistSongs);
      addToRecents(RECENT_TYPE.PLAYLIST, playlist.id);
    }
  };

  const handleQueuePlaylist = (playlist, e) => {
    e.stopPropagation();
    const playlistSongs = getPlaylistSongs(playlist);
    addToQueue(playlistSongs);
  };

  const handleViewInLibrary = (playlist) => {
    navigate('/view', { 
      state: { 
        tab: TABS.PLAYLISTS,
        filterPlaylist: playlist,
        fromPlayer: true
      } 
    });
  };

  return (
    <div className={styles.cardGrid}>
      {playlists.map((playlist, index) => {
        const playlistSongs = getPlaylistSongs(playlist);

        return (
          <PlaylistCard
            key={playlist.id}
            playlist={playlist}
            playlistSongs={playlistSongs}
            cardColor={getColorVariant(index)}
            onCardClick={handleCardClick}
            onPlayPlaylist={handlePlayPlaylist}
            onQueuePlaylist={handleQueuePlaylist}
            onViewInLibrary={handleViewInLibrary}
          />
        );
      })}
    </div>
  );
}
