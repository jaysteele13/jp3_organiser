/**
 * ContextForm Component
 * 
 * Modal form for entering upload context (album/artist/playlist) before file selection.
 * Reusable for Album, Artist, and Playlist modes via the `mode` prop.
 * 
 * Album mode: Shows Album + Artist + Year (optional) fields
 *   - Album field suggests from library
 *   - Selecting an existing album auto-fills artist and year
 *   - Artist field only suggests artists who have that album (or all if no match)
 * 
 * Artist mode: Shows Artist field only
 * 
 * Playlist mode: Shows Playlist Name field only
 *   - "Select Files" saves songs to library AND adds them to a new playlist
 *   - "Create Empty" creates an empty playlist (no songs required)
 * 
 * Uses ConfirmModal as the base modal and reuses autosuggest patterns
 * from MetadataForm for library-based suggestions.
 * 
 * @param {Object} props
 * @param {string} props.mode - 'album', 'artist', or 'playlist' from UPLOAD_MODE
 * @param {function} props.onSubmit - Called with context { album, artist, year, playlist }
 * @param {function} props.onCancel - Called when modal is cancelled
 * @param {function} props.onCreateEmpty - Called with playlist name when creating empty playlist (playlist mode only)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ConfirmModal } from '../../../../components';
import { useAutoSuggest, SuggestionSource, useLibraryContext, useDebounce } from '../../../../hooks';
import { extractLibraryEntries, extractAlbumsWithMetadata, findAlbumMatches, UPLOAD_MODE } from '../../../../utils';
import styles from './ContextForm.module.css';

/**
 * Input field with library autofill suggestions
 * Simplified version of MetadataForm's SuggestibleInput
 */
function SuggestibleInput({ 
  id, 
  name, 
  value, 
  onChange, 
  libraryEntries,
  placeholder,
  error,
  disabled = false,
}) {
  const { suggestion, source, completionText, canAccept, acceptSuggestion } = useAutoSuggest(
    '', // No filename for context form
    value,
    {
      libraryEntries,
      enableFilename: false,
      enableLibrary: libraryEntries?.length > 0,
    }
  );

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab' && canAccept) {
      e.preventDefault();
      const acceptedValue = acceptSuggestion();
      if (acceptedValue) {
        onChange({ target: { name, value: acceptedValue } });
      }
    }
  }, [canAccept, acceptSuggestion, onChange, name]);

  const isLibrarySuggestion = source === SuggestionSource.LIBRARY;

  const inputClassNames = [
    styles.input,
    error ? styles.inputError : '',
    isLibrarySuggestion ? styles.inputLibraryFocus : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.inputWrapper}>
      <input
        type="text"
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        className={inputClassNames}
        placeholder={placeholder}
        disabled={disabled}
      />
      {/* Library suggestion: show completion text after cursor */}
      {isLibrarySuggestion && completionText && (
        <div className={styles.completionOverlay}>
          <span className={styles.completionTyped}>{value}</span>
          <span className={styles.completionText}>{completionText}</span>
        </div>
      )}
      {/* Show hint badge for suggestion */}
      {suggestion && (
        <span className={styles.suggestionHint}>
          Tab to accept
        </span>
      )}
    </div>
  );
}

/**
 * Album input with smart auto-fill behavior
 * When user accepts an album suggestion, auto-fills artist and year
 */
function AlbumSuggestibleInput({ 
  id, 
  name, 
  value, 
  onChange,
  onAlbumSelect,
  albumsWithMetadata,
  placeholder,
  error,
}) {
  const debouncedValue = useDebounce(value, 100);
  
  // Find matching albums based on current input
  const matchingAlbums = useMemo(() => {
    if (!debouncedValue || debouncedValue.trim().length === 0) {
      return [];
    }
    return findAlbumMatches(debouncedValue, albumsWithMetadata, { limit: 5 });
  }, [debouncedValue, albumsWithMetadata]);

  // Get the best match for inline completion
  const bestMatch = matchingAlbums.length > 0 ? matchingAlbums[0] : null;
  
  // Calculate completion text
  const completionText = useMemo(() => {
    if (!bestMatch || !value) return null;
    const trimmedValue = value.trim();
    if (bestMatch.name.toLowerCase().startsWith(trimmedValue.toLowerCase()) && 
        bestMatch.name.toLowerCase() !== trimmedValue.toLowerCase()) {
      return bestMatch.name.slice(trimmedValue.length);
    }
    return null;
  }, [bestMatch, value]);

  const canAccept = completionText !== null && bestMatch !== null;

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab' && canAccept && bestMatch) {
      e.preventDefault();
      // Update album field
      onChange({ target: { name, value: bestMatch.name } });
      // Notify parent to auto-fill artist and year
      onAlbumSelect(bestMatch);
    }
  }, [canAccept, bestMatch, onChange, name, onAlbumSelect]);

  const inputClassNames = [
    styles.input,
    error ? styles.inputError : '',
    canAccept ? styles.inputLibraryFocus : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.inputWrapper}>
      <input
        type="text"
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        className={inputClassNames}
        placeholder={placeholder}
      />
      {/* Library suggestion: show completion text after cursor */}
      {canAccept && completionText && (
        <div className={styles.completionOverlay}>
          <span className={styles.completionTyped}>{value}</span>
          <span className={styles.completionText}>{completionText}</span>
        </div>
      )}
      {/* Show hint badge for suggestion */}
      {canAccept && (
        <span className={styles.suggestionHint}>
          Tab to accept
        </span>
      )}
    </div>
  );
}

export default function ContextForm({ mode, onSubmit, onCancel, onCreateEmpty }) {
  const { library } = useLibraryContext();
  
  const [formData, setFormData] = useState({
    album: '',
    artist: '',
    year: '',
    playlist: '',
  });
  const [errors, setErrors] = useState({});
  // Track if artist/year were auto-filled from album selection
  const [autoFilledFromAlbum, setAutoFilledFromAlbum] = useState(false);

  // Extract library entries for suggestions
  const libraryData = useMemo(() => {
    return extractLibraryEntries(library);
  }, [library]);

  // Extract albums with full metadata for smart autofill
  const albumsWithMetadata = useMemo(() => {
    return extractAlbumsWithMetadata(library);
  }, [library]);

  // Get artists who have the current album (for filtered suggestions)
  const artistsForCurrentAlbum = useMemo(() => {
    if (!formData.album.trim()) {
      return []; // No album entered, no suggestions
    }
    
    const albumLower = formData.album.trim().toLowerCase();
    // Find all albums matching the current album name
    const matchingAlbums = albumsWithMetadata.filter(
      a => a.name.toLowerCase() === albumLower
    );
    
    if (matchingAlbums.length === 0) {
      return []; // No matching album in library, no suggestions
    }
    
    // Get unique artist names from matching albums
    const artists = [...new Set(matchingAlbums.map(a => a.artistName))];
    return artists.sort();
  }, [formData.album, albumsWithMetadata]);

  const isAlbumMode = mode === UPLOAD_MODE.ALBUM;
  const isPlaylistMode = mode === UPLOAD_MODE.PLAYLIST;
  const title = isAlbumMode ? 'Add Album' : isPlaylistMode ? 'Add Playlist' : 'Add Artist';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
    // If user manually edits artist or year after auto-fill, clear the flag
    if ((name === 'artist' || name === 'year') && autoFilledFromAlbum) {
      setAutoFilledFromAlbum(false);
    }
  };

  // Handle album selection from autocomplete - auto-fill artist and year
  const handleAlbumSelect = useCallback((album) => {
    setFormData(prev => ({
      ...prev,
      artist: album.artistName || prev.artist,
      year: album.year ? String(album.year) : prev.year,
    }));
    setAutoFilledFromAlbum(true);
    // Clear any artist/year errors since we auto-filled
    setErrors(prev => ({ ...prev, artist: null, year: null }));
  }, []);

  const validate = () => {
    const newErrors = {};
    
    if (isAlbumMode) {
      if (!formData.album.trim()) {
        newErrors.album = 'Album name is required';
      }
      if (!formData.artist.trim()) {
        newErrors.artist = 'Artist name is required';
      }
    } else if (isPlaylistMode) {
      if (!formData.playlist.trim()) {
        newErrors.playlist = 'Playlist name is required';
      }
    } else {
      // Artist mode
      if (!formData.artist.trim()) {
        newErrors.artist = 'Artist name is required';
      }
    }

    // Year is optional but must be valid if provided (only for album mode)
    if (isAlbumMode && formData.year.trim()) {
      const yearNum = parseInt(formData.year.trim(), 10);
      if (isNaN(yearNum) || yearNum < 1000 || yearNum > new Date().getFullYear() + 1) {
        newErrors.year = 'Enter a valid year';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const context = {
      artist: formData.artist.trim() || null,
      album: isAlbumMode ? formData.album.trim() : null,
      year: formData.year.trim() ? parseInt(formData.year.trim(), 10) : null,
      playlist: isPlaylistMode ? formData.playlist.trim() : null,
    };

    onSubmit(context);
  };

  const handleCreateEmpty = () => {
    // Validate playlist name
    if (!formData.playlist.trim()) {
      setErrors({ playlist: 'Playlist name is required' });
      return;
    }
    onCreateEmpty(formData.playlist.trim());
  };

  return (
    <ConfirmModal
      title={title}
      confirmLabel={isPlaylistMode ? "Add Songs" : "Select Files"}
      cancelLabel="Cancel"
      onConfirm={handleSubmit}
      onCancel={onCancel}
    >
      <div className={styles.form}>
        {/* Playlist field - only in playlist mode */}
        {isPlaylistMode && (
          <div className={styles.field}>
            <label htmlFor="context-playlist" className={styles.label}>
              Playlist Name <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="context-playlist"
              name="playlist"
              value={formData.playlist}
              onChange={handleChange}
              className={`${styles.input} ${errors.playlist ? styles.inputError : ''}`}
              placeholder=""
              autoFocus
            />
            {errors.playlist && (
              <span className={styles.errorText}>{errors.playlist}</span>
            )}
          </div>
        )}

        {/* Album field - only in album mode */}
        {isAlbumMode && (
          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="context-album" className={styles.label}>
                Album Name <span className={styles.required}>*</span>
              </label>
              <AlbumSuggestibleInput
                id="context-album"
                name="album"
                value={formData.album}
                onChange={handleChange}
                onAlbumSelect={handleAlbumSelect}
                albumsWithMetadata={albumsWithMetadata}
                placeholder=""
                error={errors.album}
              />
              {errors.album && (
                <span className={styles.errorText}>{errors.album}</span>
              )}
            </div>
            <div className={styles.field}>
              <label htmlFor="context-year" className={styles.label}>
                Year
              </label>
              <input
                type="text"
                id="context-year"
                name="year"
                value={formData.year}
                onChange={handleChange}
                className={`${styles.input} ${errors.year ? styles.inputError : ''}`}
                placeholder=""
                maxLength={4}
              />
              {errors.year && (
                <span className={styles.errorText}>{errors.year}</span>
              )}
            </div>
          </div>
        )}

        {/* Artist field - album and artist modes only (not playlist) */}
        {!isPlaylistMode && (
          <div className={styles.field}>
            <label htmlFor="context-artist" className={styles.label}>
              Artist Name <span className={styles.required}>*</span>
            </label>
            <SuggestibleInput
              id="context-artist"
              name="artist"
              value={formData.artist}
              onChange={handleChange}
              libraryEntries={isAlbumMode ? artistsForCurrentAlbum : libraryData.artists}
              placeholder=""
              error={errors.artist}
            />
            {errors.artist && (
              <span className={styles.errorText}>{errors.artist}</span>
            )}
          </div>
        )}

        <p className={styles.hint}>
          {isAlbumMode 
            ? 'These values will override AcousticID album and artist results for all selected files.'
            : isPlaylistMode
            ? 'Add songs to the library and group them into this playlist, or create an empty playlist to add songs later.'
            : 'This artist will override AcousticID artist results for all selected files.'
          }
        </p>

        {/* Create Empty button - playlist mode only */}
        {isPlaylistMode && onCreateEmpty && (
          <button
            type="button"
            className={styles.createEmptyBtn}
            onClick={handleCreateEmpty}
          >
            Create Empty Playlist
          </button>
        )}
      </div>
    </ConfirmModal>
  );
}
