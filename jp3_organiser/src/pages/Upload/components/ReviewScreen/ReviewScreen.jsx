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
 * 
 * @param {Object} props
 * @param {Array} props.files - Files to review
 * @param {function} props.onComplete - Called when all files are reviewed
 * @param {function} props.onExit - Called when user exits review
 * @param {function} props.onConfirmFile - Called when a file is confirmed
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
  onComplete,
  onExit,
  onConfirmFile,
  onRemoveFile,
  onEditFile,
}) {
  // Navigation hook
  const navigation = useReviewNavigation(files, {
    onConfirm: onConfirmFile,
    onRemove: onRemoveFile,
    onEdit: onEditFile,
  });

  // Audio player hook
  const audio = useAudioPlayer();

  // Register Shift+Enter keyboard shortcut for confirm
  useKeyboardShortcut('Enter', navigation.confirmCurrent, { shift: true });

  // Stop audio when file changes
  useEffect(() => {
    audio.stop();
  }, [navigation.currentFile?.trackingId]);

  // Check if review is complete
  useEffect(() => {
    if (navigation.isComplete && files.length > 0) {
      onComplete();
    }
  }, [navigation.isComplete, files.length, onComplete]);

  // Handle save from edit mode
  const handleSaveEdit = (trackingId, metadata) => {
    navigation.saveEdit(trackingId, metadata);
  };

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
        <h2 className={styles.title}>Review Song Details</h2>
        <button className={styles.exitButton} onClick={onExit}>
          Exit Review
        </button>
      </div>

      {/* Main content */}
      <div className={styles.content}>
        {/* Edit mode */}
        {navigation.isEditMode ? (
          <div className={styles.editContainer}>
            <MetadataForm
              file={navigation.currentFile}
              onSave={handleSaveEdit}
              onCancel={navigation.exitEditMode}
            />
          </div>
        ) : (
          /* View mode */
          <SongCard
            file={navigation.currentFile}
            isPlaying={audio.isPlayingFile(navigation.currentFile.filePath)}
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
            totalPending={navigation.totalPending}
            canGoPrevious={navigation.canGoPrevious}
            canGoNext={navigation.canGoNext}
            isEditMode={navigation.isEditMode}
            onPrevious={navigation.goPrevious}
            onNext={navigation.goNext}
            onConfirm={navigation.confirmCurrent}
            onRemove={navigation.removeCurrent}
            onEdit={navigation.enterEditMode}
          />
        )}
      </div>
    </div>
  );
}
