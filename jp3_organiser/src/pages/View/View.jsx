/**
 * View Page
 * 
 * Displays the library contents parsed directly from library.bin.
 * Shows tabs for Songs, Albums, Artists, and Playlists.
 * 
 * Data is loaded fresh from the jp3 folder on disk each time,
 * mimicking how the ESP32 would parse the binary format.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { loadLibrary } from '../../services';
import { useLibraryConfig } from '../../hooks';
import styles from './View.module.css';

import {TABS} from '../../utils/enums'

// Custom Components
import StatsBar from './components/StatsBar/StatsBar';
import TabSelector from './components/Tabs/TabSelector';
import SongView from './components/Tabs/Songs'

export default function View() {
  const { libraryPath, isLoading: configLoading } = useLibraryConfig();
  const [activeTab, setActiveTab] = useState(TABS.SONGS);
  const [library, setLibrary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load library from disk when path changes or component mounts
  useEffect(() => {
    if (!libraryPath) return;

    const fetchLibrary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await loadLibrary(libraryPath);
        setLibrary(data);
      } catch (err) {
        setError(err.toString());
        setLibrary(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLibrary();
  }, [libraryPath]);

  // Refresh library data
  const handleRefresh = async () => {
    if (!libraryPath) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await loadLibrary(libraryPath);
      setLibrary(data);
    } catch (err) {
      setError(err.toString());
    } finally {
      setIsLoading(false);
    }
  };

  // Format duration from seconds to MM:SS
  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Stats for header
  const stats = useMemo(() => {
    if (!library) return { songs: 0, albums: 0, artists: 0 };
    return {
      songs: library.songs.length,
      albums: library.albums.length,
      artists: library.artists.length,
    };
  }, [library]);

  if (configLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading configuration...</div>
      </div>
    );
  }

  if (!libraryPath) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <h2>No Library Selected</h2>
          <p>Please go to Upload and select a library directory first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>Library</h1>
          <p className={styles.subtitle}>
            Parsed from: <code>{libraryPath}/jp3/metadata/library.bin</code>
          </p>
        </div>
        <button 
          className={styles.refreshButton} 
          onClick={handleRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Refresh'}
        </button>
      </header>

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      {library && (
        <>
          <StatsBar stats={stats}/>

          <TabSelector setActiveTab={setActiveTab}
          activeTab={activeTab}/>

          <div className={styles.content}>
            {activeTab === TABS.SONGS && (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Title</th>
                      <th>Artist</th>
                      <th>Album</th>
                      <th>Duration</th>
                      <th>Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {library.songs.map((song, index) => (
                      <tr key={song.id}>
                        <td className={styles.cellNum}>{index + 1}</td>
                        <td className={styles.cellTitle}>{song.title}</td>
                        <td>{song.artistName}</td>
                        <td>{song.albumName}</td>
                        <td className={styles.cellDuration}>
                          {formatDuration(song.durationSec)}
                        </td>
                        <td className={styles.cellPath}>{song.path}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {library.songs.length === 0 && (
                  <div className={styles.emptyTable}>No songs in library</div>
                )}
              </div>
            )}

            {activeTab === TABS.ALBUMS && (
              <div className={styles.cardGrid}>
                {library.albums.map((album) => {
                  const albumSongs = library.songs.filter(s => s.albumId === album.id);
                  return (
                    <div key={album.id} className={styles.card}>
                      <div className={styles.cardTitle}>{album.name}</div>
                      <div className={styles.cardSubtitle}>{album.artistName}</div>
                      <div className={styles.cardMeta}>
                        {album.year > 0 && <span>{album.year}</span>}
                        <span>{albumSongs.length} song(s)</span>
                      </div>
                    </div>
                  );
                })}
                {library.albums.length === 0 && (
                  <div className={styles.emptyTable}>No albums in library</div>
                )}
              </div>
            )}

            {activeTab === TABS.ARTISTS && (
              <div className={styles.cardGrid}>
                {library.artists.map((artist) => {
                  const artistSongs = library.songs.filter(s => s.artistId === artist.id);
                  const artistAlbums = library.albums.filter(a => a.artistId === artist.id);
                  return (
                    <div key={artist.id} className={styles.card}>
                      <div className={styles.cardTitle}>{artist.name}</div>
                      <div className={styles.cardMeta}>
                        <span>{artistAlbums.length} album(s)</span>
                        <span>{artistSongs.length} song(s)</span>
                      </div>
                    </div>
                  );
                })}
                {library.artists.length === 0 && (
                  <div className={styles.emptyTable}>No artists in library</div>
                )}
              </div>
            )}

            {activeTab === TABS.PLAYLISTS && (
              <div className={styles.emptyState}>
                <h3>Playlists</h3>
                <p>Playlist support coming soon.</p>
              </div>
            )}
          </div>
        </>
      )}

      {!library && !error && !isLoading && (
        <div className={styles.emptyState}>
          <h3>No Library Data</h3>
          <p>The library.bin file is empty or could not be parsed.</p>
        </div>
      )}
    </div>
  );
}
