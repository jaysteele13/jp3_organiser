/**
 * ReviewScreen Component
 * 
 * Full-screen review interface for confirming song metadata.
 * Allows users to step through each file, preview audio,
 * and confirm or edit metadata before adding to library.
 * 
 * Features:
 * - Step through files with navigation arrows
 * - Audio preview (play from start or middle)
 * - Confirm details or remove from list
 * - Edit metadata inline
 * - Keyboard shortcut: Shift+Enter to confirm
 * - Re-review mode: view all files including confirmed ones
 * 
 * @param {Object} props
 * @param {Array} props.files - Files to review
 * @param {boolean} props.reviewAll - If true, show all files including confirmed
 * @param {function} props.onComplete - Called when all files are reviewed
 * @param {function} props.onExit - Called when user exits review
 * @param {function} props.onConfirmFile - Called when a file is confirmed
 * @param {function} props.onUnconfirmFile - Called when a file is unconfirmed (re-review mode)
 * @param {function} props.onRemoveFile - Called when a file is removed
 * @param {function} props.onEditFile - Called when file metadata is edited
 */

import React, { useEffect } from 'react';
import { SongCard, NavigationControls } from './components';
import { useReviewNavigation, useAudioPlayer } from './hooks';
import { useKeyboardShortcut } from '../../../../hooks';
import MetadataForm from '../MetadataForm';
import styles from './ReviewScreen.module.css';

export default function ReviewScreen({
  files,
  reviewAll = false,
  onComplete,
  onExit,
  onConfirmFile,
  onUnconfirmFile,
  onRemoveFile,
  onEditFile,
}) {
  // Navigation hook
  const navigation = useReviewNavigation(files, {
    onConfirm: onConfirmFile,
    onUnconfirm: onUnconfirmFile,
    onRemove: onRemoveFile,
    onEdit: onEditFile,
    reviewAll,
  });

  // Audio player hook
  const audio = useAudioPlayer();

  // Register Shift+Enter keyboard shortcut for confirm
  useKeyboardShortcut('Enter', navigation.confirmCurrent, { shift: true });

  // Stop audio when file changes
  useEffect(() => {
    audio.stop();
  }, [navigation.currentFile?.trackingId]);

  // Check if review is complete (only trigger if not in reviewAll mode)
  useEffect(() => {
    if (!reviewAll && navigation.isComplete && files.length > 0) {
      onComplete();
    }
  }, [reviewAll, navigation.isComplete, files.length, onComplete]);

  // If no files, show nothing
  if (!navigation.currentFile) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <p>No files to review.</p>
          <button className={styles.exitButton} onClick={onExit}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>
          {reviewAll ? 'Re-Review Songs' : 'Review Song Details'}
        </h2>
        <button className={styles.exitButton} onClick={onExit}>
          {reviewAll ? 'Done Reviewing' : 'Exit Review'}
        </button>
      </div>

      {/* Main content */}
      <div className={styles.content}>
        {/* Edit mode */}
        {navigation.isEditMode ? (
          <div className={styles.editContainer}>
            <MetadataForm
              file={navigation.currentFile}
              onSave={navigation.saveEdit}
              onCancel={navigation.exitEditMode}
            />
          </div>
        ) : (
          /* View mode */
          <SongCard
            file={navigation.currentFile}
            isConfirmed={navigation.currentFile.isConfirmed}
            isPlaying={audio.isPlayingFile(navigation.currentFile.filePath)}
            isLoading={audio.isLoading}
            playbackPosition={audio.playbackPosition}
            currentTime={audio.currentTime}
            duration={audio.duration}
            audioError={audio.error}
            onPlayFromStart={audio.playFromStart}
            onPlayFromMiddle={audio.playFromMiddle}
            onPause={audio.pause}
          />
        )}

        {/* Navigation controls */}
        {!navigation.isEditMode && (
          <NavigationControls
            currentPosition={navigation.currentPosition}
            totalFiles={navigation.totalFiles}
            canGoPrevious={navigation.canGoPrevious}
            canGoNext={navigation.canGoNext}
            isConfirmed={navigation.currentFile.isConfirmed}
            reviewAll={reviewAll}
            validationError={navigation.validationError}
            onPrevious={navigation.goPrevious}
            onNext={navigation.goNext}
            onConfirm={navigation.confirmCurrent}
            onUnconfirm={navigation.unconfirmCurrent}
            onRemove={navigation.removeCurrent}
            onEdit={navigation.enterEditMode}
          />
        )}
      </div>
    </div>
  );
}
