/**
 * CoverArtPicker Component
 *
 * Modal for choosing a cover image for one album or artist ("Edit Cover Art").
 * Searches online when it opens, shows the images in a grid, and saves the
 * selected one as the cover. A "No cover" tile is always offered to go back
 * to the placeholder. "Show fun avatars" adds avatars after the images
 * found; if those cannot load (no internet), the bundled placeholders replace them.
 *
 * @param {Object} props
 * @param {string} props.libraryPath - Base library path
 * @param {{kind: string, artist: string, album: string|null}} props.target - What the cover is for (kind is a COVER_KIND)
 * @param {Function} props.onSaved - Called after the cover was saved
 * @param {Function} props.onError - Called with the error if saving failed
 * @param {Function} props.onCancel - Called when the modal is dismissed
 */

import ConfirmModal from '../ConfirmModal';
import { useCoverCandidates, SEARCH_STATUS, NO_COVER } from '../../hooks';
import { AVATAR_SOURCE } from '../../utils/avatarCandidates';
import styles from './CoverArtPicker.module.css';

const STATUS_MESSAGES = {
  [SEARCH_STATUS.SEARCHING]: 'Searching…',
  [SEARCH_STATUS.ERROR]: 'Could not search for cover art.',
};

export default function CoverArtPicker({ libraryPath, target, onSaved, onError, onCancel }) {
  const { candidates, status, selected, setSelected, showAvatars, showPlaceholders, isSaving, save } =
    useCoverCandidates(libraryPath, target);

  const subject = target.album ? `${target.album} by ${target.artist}` : target.artist;
  const isSearching = status === SEARCH_STATUS.SEARCHING;
  const nothingFound = status === SEARCH_STATUS.READY && candidates.length === 0;
  const avatarsShown = candidates.some((candidate) => candidate.source === AVATAR_SOURCE || candidate.isBundled);
  const statusMessage = STATUS_MESSAGES[status] ?? (nothingFound ? 'No cover art found' : null);

  const handleSave = async () => {
    try {
      await save();
      onSaved();
    } catch (err) {
      onError(err);
    }
  };

  return (
    <ConfirmModal
      title="Edit Cover Art"
      message={subject}
      confirmLabel="Save"
      confirmDisabled={!selected}
      isLoading={isSaving}
      onConfirm={handleSave}
      onCancel={onCancel}
    >
      {statusMessage && <p className={styles.status}>{statusMessage}</p>}
      {!isSearching && !avatarsShown && (
        <button type="button" className={styles.avatarsBtn} onClick={showAvatars}>
          Show fun avatars
        </button>
      )}

      <div className={styles.grid}>
        <button
          type="button"
          className={`${styles.tile} ${styles.noCover} ${selected === NO_COVER ? styles.selected : ''}`}
          onClick={() => setSelected(NO_COVER)}
          aria-pressed={selected === NO_COVER}
        >
          No cover
        </button>
        {candidates.map((candidate) => (
          <button
            key={candidate.url}
            type="button"
            className={`${styles.tile} ${candidate === selected ? styles.selected : ''}`}
            onClick={() => setSelected(candidate)}
            aria-pressed={candidate === selected}
          >
            <img
              src={candidate.thumbUrl}
              alt={`Cover option from ${candidate.source}`}
              className={styles.image}
              onError={candidate.source === AVATAR_SOURCE ? showPlaceholders : undefined}
            />
            <span className={styles.source}>{candidate.source}</span>
          </button>
        ))}
      </div>
    </ConfirmModal>
  );
}
