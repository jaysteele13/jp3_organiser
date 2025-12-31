/**
 * ContextForm Component
 * 
 * Modal form for entering upload context (album/artist) before file selection.
 * Reusable for both Album and Artist modes via the `mode` prop.
 * 
 * Album mode: Shows Album + Artist + Year (optional) fields
 * Artist mode: Shows Artist field only
 * 
 * Uses ConfirmModal as the base modal and reuses autosuggest patterns
 * from MetadataForm for library-based suggestions.
 * 
 * @param {Object} props
 * @param {string} props.mode - 'album' or 'artist' from UPLOAD_MODE
 * @param {function} props.onSubmit - Called with context { album, artist, year }
 * @param {function} props.onCancel - Called when modal is cancelled
 */

import { useState, useMemo, useCallback } from 'react';
import { ConfirmModal } from '../../../../components';
import { useAutoSuggest, SuggestionSource, useLibraryContext } from '../../../../hooks';
import { extractLibraryEntries, UPLOAD_MODE } from '../../../../utils';
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
  required = false,
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

export default function ContextForm({ mode, onSubmit, onCancel }) {
  const { library } = useLibraryContext();
  
  const [formData, setFormData] = useState({
    album: '',
    artist: '',
    year: '',
  });
  const [errors, setErrors] = useState({});

  // Extract library entries for suggestions
  const libraryData = useMemo(() => {
    return extractLibraryEntries(library);
  }, [library]);

  const isAlbumMode = mode === UPLOAD_MODE.ALBUM;
  const title = isAlbumMode ? 'Add Album' : 'Add Artist';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (isAlbumMode) {
      if (!formData.album.trim()) {
        newErrors.album = 'Album name is required';
      }
      if (!formData.artist.trim()) {
        newErrors.artist = 'Artist name is required';
      }
    } else {
      // Artist mode
      if (!formData.artist.trim()) {
        newErrors.artist = 'Artist name is required';
      }
    }

    // Year is optional but must be valid if provided
    if (formData.year.trim()) {
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
      artist: formData.artist.trim(),
      album: isAlbumMode ? formData.album.trim() : null,
      year: formData.year.trim() ? parseInt(formData.year.trim(), 10) : null,
    };

    onSubmit(context);
  };

  return (
    <ConfirmModal
      title={title}
      confirmLabel="Select Files"
      cancelLabel="Cancel"
      onConfirm={handleSubmit}
      onCancel={onCancel}
    >
      <div className={styles.form}>
        {/* Album field - only in album mode */}
        {isAlbumMode && (
          <div className={styles.field}>
            <label htmlFor="context-album" className={styles.label}>
              Album Name <span className={styles.required}>*</span>
            </label>
            <SuggestibleInput
              id="context-album"
              name="album"
              value={formData.album}
              onChange={handleChange}
              libraryEntries={libraryData.albums}
              placeholder="e.g. Jazz"
              error={errors.album}
              required
            />
            {errors.album && (
              <span className={styles.errorText}>{errors.album}</span>
            )}
          </div>
        )}

        {/* Artist field - both modes */}
        <div className={styles.field}>
          <label htmlFor="context-artist" className={styles.label}>
            Artist Name <span className={styles.required}>*</span>
          </label>
          <SuggestibleInput
            id="context-artist"
            name="artist"
            value={formData.artist}
            onChange={handleChange}
            libraryEntries={libraryData.artists}
            placeholder="e.g. Queen"
            error={errors.artist}
            required
          />
          {errors.artist && (
            <span className={styles.errorText}>{errors.artist}</span>
          )}
        </div>

        {/* Year field - optional, both modes */}
        <div className={styles.field}>
          <label htmlFor="context-year" className={styles.label}>
            Year <span className={styles.optional}>(optional)</span>
          </label>
          <input
            type="text"
            id="context-year"
            name="year"
            value={formData.year}
            onChange={handleChange}
            className={`${styles.input} ${errors.year ? styles.inputError : ''}`}
            placeholder="e.g. 1978"
            maxLength={4}
          />
          {errors.year && (
            <span className={styles.errorText}>{errors.year}</span>
          )}
        </div>

        <p className={styles.hint}>
          {isAlbumMode 
            ? 'These values will override AcousticID album and artist results for all selected files.'
            : 'This artist will override AcousticID artist results for all selected files.'
          }
        </p>
      </div>
    </ConfirmModal>
  );
}
