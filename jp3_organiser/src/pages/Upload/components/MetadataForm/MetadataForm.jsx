/**
 * MetadataForm Component
 * 
 * A form for manually entering/editing metadata for audio files
 * that have incomplete ID3 tags.
 * 
 * Required fields: title, artist, album
 * Optional fields: year
 * 
 * Features autofill suggestions based on filename - press Tab to accept.
 */

import React, { useState, useEffect } from 'react';
import { useAutoSuggest } from '../../../../hooks';
import styles from './MetadataForm.module.css';

/**
 * Input field with autofill suggestion overlay
 */
function SuggestibleInput({ 
  id, 
  name, 
  value, 
  onChange, 
  filename,
  placeholder,
  error,
  maxLength,
  showSuggestion = true
}) {
  const { suggestion, handleKeyDown } = useAutoSuggest(filename, value);
  
  const handleAccept = (suggestedValue) => {
    onChange({ target: { name, value: suggestedValue } });
  };

  const onKeyDown = (e) => {
    handleKeyDown(e, handleAccept);
  };

  const displaySuggestion = showSuggestion ? suggestion : null;

  return (
    <div className={styles.inputWrapper}>
      <input
        type="text"
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className={`${styles.input} ${error ? styles.inputError : ''}`}
        placeholder={displaySuggestion || placeholder}
        maxLength={maxLength}
      />
      {displaySuggestion && (
        <span className={styles.suggestionHint}>Tab to accept</span>
      )}
      
    </div>
  );
}

export default function MetadataForm({ 
  file, 
  onSave, 
  onCancel,
  onSkip 
}) {
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    album: '',
    year: '',
  });
  const [errors, setErrors] = useState({});

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
            placeholder="Song title"
            error={errors.title}
            showSuggestion={!file?.metadata?.title}
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
            placeholder="Artist name"
            error={errors.artist}
            showSuggestion={!file?.metadata?.artist}
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
            placeholder="Album name"
            error={errors.album}
            showSuggestion={!file?.metadata?.album}
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
