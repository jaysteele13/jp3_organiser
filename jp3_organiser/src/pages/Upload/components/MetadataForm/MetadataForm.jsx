/**
 * MetadataForm Component
 * 
 * A form for manually entering/editing metadata for audio files
 * that have incomplete ID3 tags.
 * 
 * Required fields: title, artist, album
 * These are the only fields displayed on the ESP32.
 */

import React, { useState, useEffect } from 'react';
import styles from './MetadataForm.module.css';

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
  });
  const [errors, setErrors] = useState({});

  // Initialize form with existing metadata
  useEffect(() => {
    if (file?.metadata) {
      setFormData({
        title: file.metadata.title || '',
        artist: file.metadata.artist || '',
        album: file.metadata.album || '',
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validate()) return;

    // Trim whitespace from all fields
    const cleanedData = {
      title: formData.title.trim(),
      artist: formData.artist.trim(),
      album: formData.album.trim(),
    };

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
          <input
            type="text"
            id={`title-${file?.trackingId}`}
            name="title"
            value={formData.title}
            onChange={handleChange}
            className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
            placeholder="Song title"
          />
          {errors.title && (
            <span className={styles.errorText}>{errors.title}</span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor={`artist-${file?.trackingId}`} className={styles.label}>
            Artist <span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            id={`artist-${file?.trackingId}`}
            name="artist"
            value={formData.artist}
            onChange={handleChange}
            className={`${styles.input} ${errors.artist ? styles.inputError : ''}`}
            placeholder="Artist name"
          />
          {errors.artist && (
            <span className={styles.errorText}>{errors.artist}</span>
          )}
        </div>

        <div className={styles.field}>
          <label htmlFor={`album-${file?.trackingId}`} className={styles.label}>
            Album <span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            id={`album-${file?.trackingId}`}
            name="album"
            value={formData.album}
            onChange={handleChange}
            className={`${styles.input} ${errors.album ? styles.inputError : ''}`}
            placeholder="Album name"
          />
          {errors.album && (
            <span className={styles.errorText}>{errors.album}</span>
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
