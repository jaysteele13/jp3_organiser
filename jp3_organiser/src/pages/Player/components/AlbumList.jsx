/**
 * AlbumList Component
 * 
 * Displays albums as cards in a flex grid layout.
 * Clicking a card navigates to the album detail page.
 * Right-click shows context menu with "View in Library" option.
 * Uses primary (rose) color scheme.
 */

import React, { useMemo, memo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../../../hooks';
import { CoverArt, ScrollingText, ContextMenu } from '../../../components';
import { addToRecents, RECENT_TYPE } from '../../../services/recentsService';
import { TABS } from '../../../utils/enums';
import styles from './ListStyles.module.css';

/**
 * Individual album card using ScrollingText for long names
 */
const AlbumCard = memo(function AlbumCard({ 
  album, 
  albumSongs, 
  libraryPath, 
  onCardClick, 
  onPlayAlbum, 
  onQueueAlbum,
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
        className={`${styles.albumCardLarge} ${styles.albumCard}`}
        onClick={() => onCardClick(album)}
        onContextMenu={handleContextMenu}
      >
        <div className={styles.cardCoverLarge}>
          <CoverArt
            artist={album.artistName}
            album={album.name}
            libraryPath={libraryPath}
            size="xlarge"
          />
        </div>
        <ScrollingText
          className={styles.cardTitle}
          containerClassName={styles.scrollContainer}
        >
          {album.name}
        </ScrollingText>
        <ScrollingText
          className={styles.cardSubtitle}
          containerClassName={styles.scrollContainer}
        >
          {album.artistName}
        </ScrollingText>
        <span className={styles.cardMeta}>
          {album.year ? `${album.year} - ` : ''}{albumSongs.length} songs
        </span>
        <div className={styles.cardActions}>
          <button
            className={styles.cardBtn}
            onClick={(e) => onPlayAlbum(album, e)}
          >
            Play
          </button>
          <button
            className={`${styles.cardBtn} ${styles.queue}`}
            onClick={(e) => onQueueAlbum(album, e)}
          >
            Queue
          </button>
        </div>
      </div>
      
      <ContextMenu
        visible={contextMenu.visible}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        items={[
          { label: 'View in Library', onClick: () => onViewInLibrary(album) }
        ]}
        onClose={closeContextMenu}
      />
    </>
  );
});

export default function AlbumList({ albums, songs, libraryPath }) {
  const navigate = useNavigate();
  const { playTrack, addToQueue } = usePlayer();

  // Group songs by album for song count
  const albumSongsMap = useMemo(() => {
    const map = {};
    songs.forEach(song => {
      if (!map[song.albumId]) {
        map[song.albumId] = [];
      }
      map[song.albumId].push(song);
    });
    // Sort each album's songs by track number
    Object.keys(map).forEach(albumId => {
      map[albumId].sort((a, b) => (a.trackNumber || 0) - (b.trackNumber || 0));
    });
    return map;
  }, [songs]);

  if (albums.length === 0) {
    return <div className={styles.empty}>No albums in library</div>;
  }

  const handleCardClick = (album) => {
    navigate(`/player/album/${album.id}`);
  };

  const handlePlayAlbum = (album, e) => {
    e.stopPropagation();
    const albumSongs = albumSongsMap[album.id] || [];
    if (albumSongs.length > 0) {
      playTrack(albumSongs[0], albumSongs);
      addToRecents(RECENT_TYPE.ALBUM, album.id);
    }
  };

  const handleQueueAlbum = (album, e) => {
    e.stopPropagation();
    const albumSongs = albumSongsMap[album.id] || [];
    addToQueue(albumSongs);
  };

  const handleViewInLibrary = (album) => {
    navigate('/view', { 
      state: { 
        tab: TABS.ALBUMS,
        filterAlbum: album,
        fromPlayer: true
      } 
    });
  };

  return (
    <div className={styles.albumGrid}>
      {albums.map((album) => {
        const albumSongs = albumSongsMap[album.id] || [];

        return (
          <AlbumCard
            key={album.id}
            album={album}
            albumSongs={albumSongs}
            libraryPath={libraryPath}
            onCardClick={handleCardClick}
            onPlayAlbum={handlePlayAlbum}
            onQueueAlbum={handleQueueAlbum}
            onViewInLibrary={handleViewInLibrary}
          />
        );
      })}
    </div>
  );
}
