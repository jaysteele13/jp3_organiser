/**
 * EditArtistModal
 * 
 * Modal dialog for editing artist metadata (name only).
 */

import { useState, useEffect } from 'react';
import styles from './EditArtistModal.module.css';

export default function EditArtistModal({ 
  artist,
  onSave,
  onCancel,
  isSaving
}) {
  const [name, setName] = useState('');

  // Initialize form when artist changes
  useEffect(() => {
    if (artist) {
      setName(artist.name || '');
    }
  }, [artist]);

  if (!artist) {
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    onSave(artist.id, name.trim());
  };

  const hasChanges = name.trim() !== artist.name;

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Edit Artist</h2>
        
        <p className={styles.info}>
          Update the artist name. All songs and albums by this artist will reflect the change.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Artist Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              placeholder="Artist name"
              required
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
              disabled={isSaving || !hasChanges || !name.trim()}
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
