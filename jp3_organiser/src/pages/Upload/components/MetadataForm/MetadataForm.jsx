/**
 * MetadataForm Component
 * 
 * A form for manually entering/editing metadata for audio files
 * that have incomplete ID3 tags.
 * 
 * Required fields: title, artist, album
 * Optional fields: year
 * 
 * Features hybrid autofill suggestions:
 * - Empty field: Shows filename-based heuristic suggestion (Tab to accept)
 * - Typing: Shows library-based fuzzy match suggestions (Tab to accept)
 * 
 * Uses LibraryContext for autosuggest data (no prop drilling).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAutoSuggest, SuggestionSource, useLibraryContext } from '../../../../hooks';
import { extractLibraryEntries } from '../../../../utils';
import styles from './MetadataForm.module.css';

/**
 * Input field with hybrid autofill suggestions
 * - Filename suggestion shown as placeholder when empty
 * - Library suggestion shown as inline completion when typing
 */
function SuggestibleInput({ 
  id, 
  name, 
  value, 
  onChange, 
  filename,
  libraryEntries,
  placeholder,
  error,
  maxLength,
  enableSuggestions = true
}) {
  const { suggestion, source, completionText, canAccept, acceptSuggestion } = useAutoSuggest(
    filename, 
    value,
    {
      libraryEntries,
      enableFilename: enableSuggestions,
      enableLibrary: enableSuggestions && libraryEntries?.length > 0,
    }
  );

  // Handle keyboard events - component owns this responsibility
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Tab' && canAccept) {
      e.preventDefault();
      const acceptedValue = acceptSuggestion();
      if (acceptedValue) {
        onChange({ target: { name, value: acceptedValue } });
      }
    }
  }, [canAccept, acceptSuggestion, onChange, name]);

  // Determine what to show based on suggestion source
  const isFilenameSuggestion = source === SuggestionSource.FILENAME;
  const isLibrarySuggestion = source === SuggestionSource.LIBRARY;

  // For filename suggestions, use placeholder
  // For library suggestions, show inline completion overlay
  const displayPlaceholder = isFilenameSuggestion ? suggestion : placeholder;

  // Build input class names based on suggestion source
  const inputClassNames = [
    styles.input,
    error ? styles.inputError : '',
    isFilenameSuggestion ? styles.inputFilenameFocus : '',
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
        placeholder={displayPlaceholder}
        maxLength={maxLength}
      />
      {/* Library suggestion: show completion text after cursor */}
      {isLibrarySuggestion && completionText && (
        <div className={styles.completionOverlay}>
          <span className={styles.completionTyped}>{value}</span>
          <span className={styles.completionText}>{completionText}</span>
        </div>
      )}
      {/* Show hint badge for either suggestion type */}
      {suggestion && (
        <span className={`${styles.suggestionHint} ${isLibrarySuggestion ? styles.libraryHint : ''}`}>
          Tab to accept
        </span>
      )}
    </div>
  );
}

export default function MetadataForm({ 
  file, 
  onSave, 
  onCancel,
  onSkip,
}) {
  // Get library data from context
  const { library } = useLibraryContext();

  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    album: '',
    year: '',
  });
  const [errors, setErrors] = useState({});

  // Extract library entries for suggestions
  const libraryData = useMemo(() => {
    return extractLibraryEntries(library);
  }, [library]);

  // Initialize form with existing metadata
  useEffect(() => {
    if (file?.metadata) {
      setFormData({
        title: file.metadata.title || '',
        artist: file.metadata.artist || '',
        album: file.metadata.album || '',
        year: file.metadata.year?.toString() || '',
      });
    }
  }, [file]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.artist.trim()) {
      newErrors.artist = 'Artist is required';
    }
    if (!formData.album.trim()) {
      newErrors.album = 'Album is required';
    }
    // Year is optional but must be a valid number if provided
    if (formData.year.trim()) {
      const yearNum = parseInt(formData.year.trim(), 10);
      if (isNaN(yearNum) || yearNum < 1000 || yearNum > new Date().getFullYear() + 1) {
        newErrors.year = 'Enter a valid year (1000-present)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    // Trim whitespace and parse year
    const cleanedData = {
      title: formData.title.trim(),
      artist: formData.artist.trim(),
      album: formData.album.trim(),
    };

    // Only include year if provided
    if (formData.year.trim()) {
      cleanedData.year = parseInt(formData.year.trim(), 10);
    }

    onSave(file.trackingId, cleanedData);
  };

  const getMissingFields = () => {
    const missing = [];
    if (!file?.metadata?.title) missing.push('title');
    if (!file?.metadata?.artist) missing.push('artist');
    if (!file?.metadata?.album) missing.push('album');
    return missing;
  };

  const missingFields = getMissingFields();

  return (
    <div className={styles.formContainer}>
      <div className={styles.header}>
        <h4 className={styles.title}>Complete Metadata</h4>
        <p className={styles.fileName}>{file?.fileName}</p>
        {missingFields.length > 0 && (
          <p className={styles.missingInfo}>
            Missing: {missingFields.join(', ')}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor={`title-${file?.trackingId}`} className={styles.label}>
            Title <span className={styles.required}>*</span>
          </label>
          <SuggestibleInput
            id={`title-${file?.trackingId}`}
            name="title"
            value={formData.title}
            onChange={handleChange}
            filename={file?.fileName}
            libraryEntries={libraryData.titles}
            placeholder="Song title"
            error={errors.title}
            enableSuggestions={!file?.metadata?.title}
          />
          {errors.title && (
            <span className={styles.errorText}>{errors.title}</span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor={`artist-${file?.trackingId}`} className={styles.label}>
            Artist <span className={styles.required}>*</span>
          </label>
          <SuggestibleInput
            id={`artist-${file?.trackingId}`}
            name="artist"
            value={formData.artist}
            onChange={handleChange}
            filename={file?.fileName}
            libraryEntries={libraryData.artists}
            placeholder="Artist name"
            error={errors.artist}
            enableSuggestions={!file?.metadata?.artist}
          />
          {errors.artist && (
            <span className={styles.errorText}>{errors.artist}</span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor={`album-${file?.trackingId}`} className={styles.label}>
            Album <span className={styles.required}>*</span>
          </label>
          <SuggestibleInput
            id={`album-${file?.trackingId}`}
            name="album"
            value={formData.album}
            onChange={handleChange}
            filename={file?.fileName}
            libraryEntries={libraryData.albums}
            placeholder="Album name"
            error={errors.album}
            enableSuggestions={!file?.metadata?.album}
          />
          {errors.album && (
            <span className={styles.errorText}>{errors.album}</span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor={`year-${file?.trackingId}`} className={styles.label}>
            Year <span className={styles.optional}>(optional)</span>
          </label>
          <input
            type="text"
            id={`year-${file?.trackingId}`}
            name="year"
            value={formData.year}
            onChange={handleChange}
            className={`${styles.input} ${errors.year ? styles.inputError : ''}`}
            placeholder="Release year"
            maxLength={4}
          />
          {errors.year && (
            <span className={styles.errorText}>{errors.year}</span>
          )}
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.saveButton}>
            Save
          </button>
          {onSkip && (
            <button 
              type="button" 
              className={styles.skipButton}
              onClick={() => onSkip(file.trackingId)}
            >
              Skip
            </button>
          )}
          {onCancel && (
            <button 
              type="button" 
              className={styles.cancelButton}
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
