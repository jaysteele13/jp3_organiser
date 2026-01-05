/**
 * PlaylistView Component
 * 
 * Displays playlists in a card grid format.
 * Each card shows playlist name and song count.
 * Cards are expandable to show the list of songs.
 * "Manage" button navigates to the PlaylistEdit page.
 * 
 * @param {Object} props
 * @param {Object} props.library - Library data containing songs and playlists
 * @param {string} props.libraryPath - Library path for loading full playlist data
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadPlaylist } from '../../../../../services/libraryService';
import { formatDuration } from '../../../../../utils/formatters';
import styles from './PlaylistView.module.css';

/**
 * Build a lookup map from song ID to song details
 */
function buildSongLookup(library) {
  const lookup = new Map();
  if (library?.songs) {
    library.songs.forEach(song => {
      lookup.set(song.id, song);
    });
  }
  return lookup;
}

/**
 * PlaylistCard Component
 * 
 * Individual playlist card with expandable song list.
 * Fetches full playlist data (including songIds) when expanded.
 */
function PlaylistCard({ playlist, songLookup, libraryPath, onManage }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [songIds, setSongIds] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleManageClick = useCallback((e) => {
    e.stopPropagation();
    onManage(playlist.id);
  }, [playlist.id, onManage]);

  // Fetch full playlist data when expanded
  useEffect(() => {
    if (isExpanded && songIds === null && libraryPath) {
      setIsLoading(true);
      loadPlaylist(libraryPath, playlist.id)
        .then(fullPlaylist => {
          setSongIds(fullPlaylist.songIds || []);
        })
        .catch(err => {
          console.error('Failed to load playlist:', err);
          setSongIds([]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isExpanded, songIds, libraryPath, playlist.id]);

  // Reset songIds when playlist changes (e.g., after editing)
  useEffect(() => {
    setSongIds(null);
  }, [playlist.songCount]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardInfo} onClick={toggleExpand}>
          <span className={styles.cardIcon}>☰</span>
          <div className={styles.cardText}>
            <span className={styles.cardTitle}>{playlist.name}</span>
            <span className={styles.cardMeta}>
              {playlist.songCount} song{playlist.songCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <button 
          className={styles.manageBtn}
          onClick={handleManageClick}
          title="Manage playlist"
        >
          Manage
        </button>
      </div>
      
      {isExpanded && (
        <div className={styles.songList}>
          {isLoading ? (
            <p className={styles.loadingText}>Loading songs...</p>
          ) : songIds && songIds.length > 0 ? (
            <ul className={styles.songs}>
              {songIds.map((songId, index) => {
                const song = songLookup.get(songId);
                if (!song) {
                  return (
                    <li key={songId} className={styles.songItem}>
                      <span className={styles.songIndex}>{index + 1}</span>
                      <span className={styles.songTitle}>Unknown Song (ID: {songId})</span>
                    </li>
                  );
                }
                return (
                  <li key={songId} className={styles.songItem}>
                    <span className={styles.songIndex}>{index + 1}</span>
                    <div className={styles.songDetails}>
                      <span className={styles.songTitle}>{song.title}</span>
                      <span className={styles.songArtist}>{song.artistName}</span>
                    </div>
                    
                  </li>
                );
              })}
            </ul>
          ) : songIds && songIds.length === 0 ? (
            <p className={styles.noSongs}>This playlist is empty.</p>
          ) : (
            <p className={styles.noSongs}>
              Unable to load song details.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlaylistView({ library, libraryPath }) {
  const navigate = useNavigate();
  const playlists = library?.playlists || [];
  const songLookup = useMemo(() => buildSongLookup(library), [library]);

  const handleManage = useCallback((playlistId) => {
    navigate(`/playlist/${playlistId}`);
  }, [navigate]);

  if (playlists.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h3>No Playlists</h3>
        <p>Create a playlist using the "Add Playlist" option in Upload.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {playlists.map(playlist => (
        <PlaylistCard 
          key={playlist.id} 
          playlist={playlist} 
          songLookup={songLookup}
          libraryPath={libraryPath}
          onManage={handleManage}
        />
      ))}
    </div>
  );
}
