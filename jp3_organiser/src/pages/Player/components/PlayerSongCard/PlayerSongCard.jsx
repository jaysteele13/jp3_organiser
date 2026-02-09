/**
 * PlayerSongCard Component
 * 
 * Reusable song row for Player lists (SongList, AlbumList, ArtistList, PlaylistList).
 * Click the row to play, use Queue button to add to queue.
 * Artist and album names are clickable links that navigate to their detail pages.
 * Right-click shows context menu with "View in Library" option.
 * 
 * Props:
 * - song: Song object with title, artistName, albumName, artistId, albumId, trackNumber
 * - isPlaying: Whether this song is currently playing
 * - onPlay: Callback when row is clicked
 * - onQueue: Callback when Queue button is clicked
 * - showTrackColumn: Show track number as separate column
 * - subtitle: Custom subtitle string (disables artist/album links when provided)
 * 
 * Memoized to prevent unnecessary re-renders in large lists.
 */

import React, { memo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ContextMenu } from '../../../../components';
import { TABS } from '../../../../utils/enums';
import styles from './PlayerSongCard.module.css';

function PlayerSongCard({ 
  song, 
  isPlaying = false,
  onPlay, 
  onQueue,
  showTrackColumn = false,
  trackNumber,
  subtitle
}) {
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  const handleViewInLibrary = useCallback(() => {
    navigate('/view', { 
      state: { 
        tab: TABS.SONGS,
        filterSong: song,
        fromPlayer: true
      } 
    });
  }, [navigate, song]);

  const handleQueue = (e) => {
    e.stopPropagation();
    onQueue?.(song);
  };

  const handleRowClick = () => {
    onPlay?.(song);
  };

  const handleArtistClick = (e) => {
    e.stopPropagation();
    if (song.artistId) {
      navigate(`/player/artist/${song.artistId}`);
    }
  };

  const handleAlbumClick = (e) => {
    e.stopPropagation();
    if (song.albumId) {
      navigate(`/player/album/${song.albumId}`);
    }
  };

  const trackNum = trackNumber !== undefined ? trackNumber : (song.trackNumber || '');
  const showTrack = showTrackColumn && trackNum;

  // Determine if we should use custom subtitle or interactive links
  const useCustomSubtitle = subtitle !== undefined;
  const hasArtistLink = !useCustomSubtitle && song.artistId;
  const hasAlbumLink = !useCustomSubtitle && song.albumId && song.albumName;

  return (
    <div className={styles.padding}>
      <div 
        className={`${styles.row} ${isPlaying ? styles.playing : ''}`}
        onClick={handleRowClick}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleRowClick()}
      >
        {showTrack ? (
          <span className={styles.trackNumber}>{trackNum}</span>
        ) : (
          showTrackColumn && <span className={`${styles.trackNumber} ${styles.hidden}`}>0</span>
        )}
        <div className={styles.info}>
          <span className={styles.title}>{song.title}</span>
          
          {useCustomSubtitle ? (
            // Custom subtitle - render as plain text
            subtitle && <span className={styles.subtitle}>{subtitle}</span>
          ) : (
            // Default subtitle with clickable artist/album links
            <span className={styles.subtitle}>
              {hasArtistLink ? (
                <span
                  className={styles.subtitleLink}
                  onClick={handleArtistClick}
                  onKeyDown={(e) => e.key === 'Enter' && handleArtistClick(e)}
                  role="link"
                  tabIndex={0}
                >
                  {song.artistName || 'Unknown'}
                </span>
              ) : (
                <span>{song.artistName || 'Unknown'}</span>
              )}
              
              {song.albumName && (
                <>
                  <span className={styles.subtitleSeparator}> - </span>
                  {hasAlbumLink ? (
                    <span
                      className={styles.subtitleLink}
                      onClick={handleAlbumClick}
                      onKeyDown={(e) => e.key === 'Enter' && handleAlbumClick(e)}
                      role="link"
                      tabIndex={0}
                    >
                      {song.albumName}
                    </span>
                  ) : (
                    <span>{song.albumName}</span>
                  )}
                </>
              )}
            </span>
          )}
        </div>
        <div className={styles.actions}>
          <button 
            className={`${styles.actionBtn} ${styles.queue}`}
            onClick={handleQueue}
          >
            Queue
          </button>
        </div>
      </div>
      
      <ContextMenu
        visible={contextMenu.visible}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        items={[
          { label: 'View in Library', onClick: handleViewInLibrary }
        ]}
        onClose={closeContextMenu}
      />
    </div>
  );
}

export default memo(PlayerSongCard);
