/**
 * EditAlbumModal
 * 
 * Modal dialog for editing album metadata (name, artist, year).
 */

import { useState, useEffect } from 'react';
import styles from './EditAlbumModal.module.css';

export default function EditAlbumModal({ 
  album,
  onSave,
  onCancel,
  isSaving
}) {
  const [name, setName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [year, setYear] = useState('');

  // Initialize form when album changes
  useEffect(() => {
    if (album) {
      setName(album.name || '');
      setArtistName(album.artistName || '');
      setYear(album.year > 0 ? String(album.year) : '');
    }
  }, [album]);

  if (!album) {
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !artistName.trim()) {
      return;
    }
    const yearValue = year ? parseInt(year, 10) : null;
    onSave(album.id, name.trim(), artistName.trim(), yearValue);
  };

  const hasChanges = 
    name.trim() !== album.name || 
    artistName.trim() !== album.artistName || 
    (year ? parseInt(year, 10) : 0) !== album.year;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Edit Album</h2>
        
        <p className={styles.info}>
          Update the album metadata. All songs in this album will be updated.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Album Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              placeholder="Album name"
              required
              disabled={isSaving}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Artist</label>
            <input
              type="text"
              value={artistName}
              onChange={(e) => setArtistName(e.target.value)}
              className={styles.input}
              placeholder="Artist name"
              required
              disabled={isSaving}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Year (optional)</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={styles.input}
              placeholder="Release year"
              min="1900"
              max="2100"
              disabled={isSaving}
            />
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={onCancel}
              className={styles.cancelButton}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={isSaving || !hasChanges || !name.trim() || !artistName.trim()}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {isSaving && (
          <div className={styles.savingOverlay}>
            <span>Saving...</span>
          </div>
        )}
      </div>
    </div>
  );
}
