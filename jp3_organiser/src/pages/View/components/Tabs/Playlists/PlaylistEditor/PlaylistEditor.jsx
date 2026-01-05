/**
 * PlaylistEditor Component
 * 
 * Modal for managing playlist contents.
 * Shows current songs with remove buttons, and a song picker to add new songs.
 * 
 * @param {Object} props
 * @param {Object} props.editor - Editor state and actions from usePlaylistEditor hook
 * @param {Map} props.songLookup - Map of songId -> song object
 * @param {Array} props.allSongs - All songs in library for the picker
 */

import { useMemo } from 'react';
import styles from './PlaylistEditor.module.css';

/**
 * Format duration from seconds to MM:SS
 */
function formatDuration(seconds) {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * SongRow - Displays a song in the current playlist with remove button
 */
function CurrentSongRow({ song, index, onRemove, isLoading }) {
  return (
    <li className={styles.songRow}>
      <span className={styles.songIndex}>{index + 1}</span>
      <div className={styles.songInfo}>
        <span className={styles.songTitle}>{song?.title || 'Unknown'}</span>
        <span className={styles.songArtist}>{song?.artistName || 'Unknown'}</span>
      </div>
      <span className={styles.songDuration}>{formatDuration(song?.durationSec)}</span>
      <button
        className={styles.removeBtn}
        onClick={() => onRemove(song.id)}
        disabled={isLoading}
        title="Remove from playlist"
        aria-label={`Remove ${song?.title} from playlist`}
      >
        ×
      </button>
    </li>
  );
}

/**
 * PickerSongRow - Displays a song in the picker with checkbox
 */
function PickerSongRow({ song, isSelected, isInPlaylist, onToggle }) {
  const handleClick = () => {
    if (!isInPlaylist) {
      onToggle(song.id);
    }
  };

  return (
    <li 
      className={`${styles.pickerRow} ${isInPlaylist ? styles.pickerRowDisabled : ''} ${isSelected ? styles.pickerRowSelected : ''}`}
      onClick={handleClick}
    >
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={isSelected}
        disabled={isInPlaylist}
        onChange={() => onToggle(song.id)}
        onClick={(e) => e.stopPropagation()}
      />
      <div className={styles.songInfo}>
        <span className={styles.songTitle}>{song.title}</span>
        <span className={styles.songArtist}>{song.artistName}</span>
      </div>
      <span className={styles.songDuration}>{formatDuration(song.durationSec)}</span>
      {isInPlaylist && <span className={styles.inPlaylistBadge}>In playlist</span>}
    </li>
  );
}

export default function PlaylistEditor({ editor, songLookup, allSongs }) {
  // Destructure editor state and actions
  const {
    playlist,
    isLoading,
    error,
    selectedSongIds,
    playlistSongIdSet,
    searchQuery,
    closeEditor,
    removeSong,
    addSelectedSongs,
    toggleSongSelection,
    clearSelection,
    updateSearchQuery,
  } = editor;

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

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      closeEditor();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>
            Edit Playlist: {playlist?.name || 'Loading...'}
          </h2>
          <button 
            className={styles.closeBtn} 
            onClick={closeEditor}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className={styles.errorBanner}>
            {error}
          </div>
        )}

        {/* Loading state */}
        {isLoading && !playlist && (
          <div className={styles.loadingState}>
            Loading playlist...
          </div>
        )}

        {/* Content */}
        {playlist && (
          <div className={styles.content}>
            {/* Current Songs Section */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                Current Songs ({currentSongs.length})
              </h3>
              {currentSongs.length === 0 ? (
                <p className={styles.emptyMessage}>
                  This playlist is empty. Add songs below.
                </p>
              ) : (
                <ul className={styles.songList}>
                  {currentSongs.map((song, index) => (
                    <CurrentSongRow
                      key={song.id}
                      song={song}
                      index={index}
                      onRemove={removeSong}
                      isLoading={isLoading}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* Add Songs Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>Add Songs</h3>
                {selectedSongIds.size > 0 && (
                  <div className={styles.selectionActions}>
                    <span className={styles.selectionCount}>
                      {selectedSongIds.size} selected
                    </span>
                    <button
                      className={styles.clearSelectionBtn}
                      onClick={clearSelection}
                    >
                      Clear
                    </button>
                    <button
                      className={styles.addSelectedBtn}
                      onClick={addSelectedSongs}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Adding...' : `Add ${selectedSongIds.size} Song${selectedSongIds.size > 1 ? 's' : ''}`}
                    </button>
                  </div>
                )}
              </div>

              {/* Search input */}
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search songs by title, artist, or album..."
                value={searchQuery}
                onChange={(e) => updateSearchQuery(e.target.value)}
              />

              {/* Song picker list */}
              <div className={styles.pickerContainer}>
                {filteredSongs.length === 0 ? (
                  <p className={styles.emptyMessage}>
                    {searchQuery ? 'No songs match your search.' : 'No songs in library.'}
                  </p>
                ) : (
                  <ul className={styles.pickerList}>
                    {filteredSongs.map(song => (
                      <PickerSongRow
                        key={song.id}
                        song={song}
                        isSelected={selectedSongIds.has(song.id)}
                        isInPlaylist={playlistSongIdSet.has(song.id)}
                        onToggle={toggleSongSelection}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.doneBtn} onClick={closeEditor}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
