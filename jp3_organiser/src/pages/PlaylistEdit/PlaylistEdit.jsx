/**
 * PlaylistEdit Page
 * 
 * Full-page editor for managing playlist contents.
 * Shows current songs with remove buttons, and a song picker to add new songs.
 * Uses two-column layout for better use of screen space.
 * 
 * Route: /playlist/:id
 */

import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLibraryConfig } from '../../hooks';
import { useLibrary } from '../../hooks/useLibrary';
import { LoadingState, ErrorState, EmptyState } from '../../components';
import { TABS } from '../../utils/enums';
import { formatDuration } from '../../utils/formatters';
import usePlaylistEdit from './usePlaylistEdit';
import styles from './PlaylistEdit.module.css';

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
 * CurrentSongRow - Song in playlist with remove button
 */
function CurrentSongRow({ song, index, onRemove, isDisabled }) {
  return (
    <tr className={styles.songRow}>
      <td className={styles.cellIndex}>{index + 1}</td>
      <td className={styles.cellTitle}>{song?.title || 'Unknown'}</td>
      <td className={styles.cellArtist}>{song?.artistName || 'Unknown'}</td>
      <td className={styles.cellDuration}>{formatDuration(song?.durationSec)}</td>
      <td className={styles.cellAction}>
        <button
          className={styles.removeBtn}
          onClick={() => onRemove(song.id)}
          disabled={isDisabled}
          title="Remove from playlist"
        >
          ×
        </button>
      </td>
    </tr>
  );
}

/**
 * PickerSongRow - Song in the add picker with checkbox
 */
function PickerSongRow({ song, isSelected, isInPlaylist, onToggle }) {
  const handleClick = () => {
    if (!isInPlaylist) {
      onToggle(song.id);
    }
  };

  return (
    <tr 
      className={`${styles.pickerRow} ${isInPlaylist ? styles.pickerRowDisabled : ''} ${isSelected ? styles.pickerRowSelected : ''}`}
      onClick={handleClick}
    >
      <td className={styles.cellCheckbox}>
        <input
          type="checkbox"
          checked={isSelected}
          disabled={isInPlaylist}
          onChange={() => onToggle(song.id)}
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td className={styles.cellTitle}>{song.title}</td>
      <td className={styles.cellArtist}>{song.artistName}</td>
      <td className={styles.cellAlbum}>{song.albumName}</td>
      <td className={styles.cellDuration}>{formatDuration(song.durationSec)}</td>
      <td className={styles.cellStatus}>
        {isInPlaylist && <span className={styles.inPlaylistBadge}>Added</span>}
      </td>
    </tr>
  );
}

export default function PlaylistEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const playlistId = parseInt(id, 10);

  const { libraryPath, isLoading: configLoading } = useLibraryConfig();
  const { library, isLoading: libraryLoading } = useLibrary(libraryPath);

  const editor = usePlaylistEdit(libraryPath, playlistId);
  const {
    playlist,
    isLoading: playlistLoading,
    isSaving,
    error,
    selectedSongIds,
    searchQuery,
    playlistSongIdSet,
    removeSong,
    addSelectedSongs,
    toggleSongSelection,
    clearSelection,
    updateSearchQuery,
  } = editor;

  const songLookup = useMemo(() => buildSongLookup(library), [library]);
  const allSongs = library?.songs || [];

  // Filter songs for picker based on search query
  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) {
      return allSongs;
    }
    const query = searchQuery.toLowerCase();
    return allSongs.filter(song => 
      song.title.toLowerCase().includes(query) ||
      song.artistName.toLowerCase().includes(query) ||
      song.albumName.toLowerCase().includes(query)
    );
  }, [allSongs, searchQuery]);

  // Get current playlist songs with details
  const currentSongs = useMemo(() => {
    if (!playlist?.songIds) return [];
    return playlist.songIds.map(id => songLookup.get(id)).filter(Boolean);
  }, [playlist?.songIds, songLookup]);

  const handleBack = () => {
    navigate('/view', { state: { tab: TABS.PLAYLISTS } });
  };

  // Loading states
  if (configLoading || libraryLoading || playlistLoading) {
    return <LoadingState message="Loading playlist..." />;
  }

  // Error states
  if (!libraryPath) {
    return (
      <EmptyState 
        title="No Library Selected"
        message="Please go to Upload and select a library directory first."
      />
    );
  }

  if (isNaN(playlistId)) {
    return (
      <EmptyState 
        title="Invalid Playlist"
        message="The playlist ID is not valid."
      />
    );
  }

  if (!playlist && !playlistLoading) {
    return (
      <EmptyState 
        title="Playlist Not Found"
        message="The playlist could not be loaded."
      />
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={handleBack}>
            ← Back
          </button>
          <div className={styles.headerInfo}>
            <h1 className={styles.title}>{playlist?.name}</h1>
            <span className={styles.subtitle}>
              {currentSongs.length} song{currentSongs.length !== 1 ? 's' : ''} in playlist
            </span>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && <ErrorState error={error} />}

      {/* Main content - two columns */}
      <div className={styles.content}>
        {/* Left column - Current songs */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Playlist Songs</h2>
          
          {currentSongs.length === 0 ? (
            <div className={styles.emptySection}>
              <p>This playlist is empty.</p>
              <p>Add songs from the library on the right.</p>
            </div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thIndex}>#</th>
                    <th>Title</th>
                    <th>Artist</th>
                    <th className={styles.thDuration}>Duration</th>
                    <th className={styles.thAction}></th>
                  </tr>
                </thead>
                <tbody>
                  {currentSongs.map((song, index) => (
                    <CurrentSongRow
                      key={song.id}
                      song={song}
                      index={index}
                      onRemove={removeSong}
                      isDisabled={isSaving}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right column - Add songs */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Add from Library</h2>
            {selectedSongIds.size > 0 && (
              <div className={styles.selectionActions}>
                <span className={styles.selectionCount}>
                  {selectedSongIds.size} selected
                </span>
                <button
                  className={styles.clearBtn}
                  onClick={clearSelection}
                >
                  Clear
                </button>
                <button
                  className={styles.addBtn}
                  onClick={addSelectedSongs}
                  disabled={isSaving}
                >
                  {isSaving ? 'Adding...' : `Add ${selectedSongIds.size} Song${selectedSongIds.size > 1 ? 's' : ''}`}
                </button>
              </div>
            )}
          </div>

          {/* Search input */}
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by title, artist, or album..."
            value={searchQuery}
            onChange={(e) => updateSearchQuery(e.target.value)}
          />

          {/* Song picker table */}
          <div className={styles.tableContainer}>
            {filteredSongs.length === 0 ? (
              <div className={styles.emptySection}>
                <p>{searchQuery ? 'No songs match your search.' : 'No songs in library.'}</p>
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thCheckbox}></th>
                    <th>Title</th>
                    <th>Artist</th>
                    <th>Album</th>
                    <th className={styles.thDuration}>Duration</th>
                    <th className={styles.thStatus}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSongs.map(song => (
                    <PickerSongRow
                      key={song.id}
                      song={song}
                      isSelected={selectedSongIds.has(song.id)}
                      isInPlaylist={playlistSongIdSet.has(song.id)}
                      onToggle={toggleSongSelection}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
