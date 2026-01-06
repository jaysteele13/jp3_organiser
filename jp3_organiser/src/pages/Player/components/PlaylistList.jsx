/**
 * PlaylistList Component
 * 
 * Displays playlists with expandable song lists.
 * Play queues all playlist songs.
 */

import React, { useState, useMemo } from 'react';
import { usePlayer } from '../../../hooks';
import { formatDuration } from '../../../utils/formatters';
import styles from './ListStyles.module.css';

export default function PlaylistList({ playlists, songs }) {
  const { playTrack, addToQueue, isCurrentTrack } = usePlayer();
  const [expandedPlaylistId, setExpandedPlaylistId] = useState(null);

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
      .filter(Boolean); // Filter out any undefined songs
  };

  if (playlists.length === 0) {
    return <div className={styles.empty}>No playlists in library</div>;
  }

  const toggleExpand = (playlistId) => {
    setExpandedPlaylistId(prev => prev === playlistId ? null : playlistId);
  };

  const handlePlayPlaylist = (playlist, e) => {
    e.stopPropagation();
    const playlistSongs = getPlaylistSongs(playlist);
    if (playlistSongs.length > 0) {
      playTrack(playlistSongs[0], playlistSongs);
    }
  };

  const handleQueuePlaylist = (playlist, e) => {
    e.stopPropagation();
    const playlistSongs = getPlaylistSongs(playlist);
    addToQueue(playlistSongs);
  };

  const handlePlaySong = (song, playlistSongs) => {
    playTrack(song, playlistSongs);
  };

  const handleQueueSong = (song, e) => {
    e.stopPropagation();
    addToQueue(song);
  };

  return (
    <div className={styles.list}>
      {playlists.map((playlist) => {
        const playlistSongs = getPlaylistSongs(playlist);
        const isExpanded = expandedPlaylistId === playlist.id;

        return (
          <div key={playlist.id}>
            <div 
              className={styles.groupHeader}
              onClick={() => toggleExpand(playlist.id)}
            >
              <div className={styles.groupInfo}>
                <span className={styles.groupTitle}>{playlist.name}</span>
                <span className={styles.groupSubtitle}>
                  {playlistSongs.length} songs
                </span>
              </div>
              <div className={styles.groupActions}>
                <button 
                  className={styles.actionBtn}
                  onClick={(e) => handlePlayPlaylist(playlist, e)}
                  disabled={playlistSongs.length === 0}
                >
                  Play
                </button>
                <button 
                  className={`${styles.actionBtn} ${styles.queue}`}
                  onClick={(e) => handleQueuePlaylist(playlist, e)}
                  disabled={playlistSongs.length === 0}
                >
                  Queue
                </button>
              </div>
            </div>

            {isExpanded && (
              <div className={styles.groupSongs}>
                {playlistSongs.length === 0 ? (
                  <div className={styles.empty}>Playlist is empty</div>
                ) : (
                  playlistSongs.map((song, index) => (
                    <div 
                      key={`${playlist.id}-${song.id}-${index}`} 
                      className={`${styles.row} ${isCurrentTrack(song.id) ? styles.playing : ''}`}
                    >
                      <div className={styles.info}>
                        <span className={styles.title}>{song.title}</span>
                        <span className={styles.subtitle}>
                          {song.artistName}{song.albumName ? ` - ${song.albumName}` : ''}
                        </span>
                      </div>
                      <span className={styles.duration}>
                        {formatDuration(song.durationSec)}
                      </span>
                      <div className={styles.actions}>
                        <button 
                          className={styles.actionBtn}
                          onClick={() => handlePlaySong(song, playlistSongs)}
                        >
                          Play
                        </button>
                        <button 
                          className={`${styles.actionBtn} ${styles.queue}`}
                          onClick={(e) => handleQueueSong(song, e)}
                        >
                          Queue
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
