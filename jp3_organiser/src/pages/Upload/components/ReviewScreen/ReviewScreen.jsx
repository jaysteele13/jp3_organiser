/**
 * ReviewScreen Component
 * 
 * Full-screen review interface for confirming song metadata.
 * Allows users to step through each file, preview audio,
 * and confirm or edit metadata before adding to library.
 * 
 * Features:
 * - Navigate freely between all files (confirmed or not)
 * - Confirm/unconfirm any file at any time
 * - Audio preview (play from start or middle)
 * - Edit metadata inline with autosuggest (uses LibraryContext)
 * - Keyboard shortcut: Shift+Enter to confirm
 * - Persists navigation position across page navigation
 * 
 * Exit behavior:
 * - "Done" button: Only enabled when all files confirmed, triggers onDone
 * - "Exit" button: Always available, exits immediately (confirmed files are already saved)
 * 
 * @param {Object} props
 * @param {Array} props.files - Files to review
 * @param {Object} props.initialState - Initial navigation state { currentIndex, isEditMode }
 * @param {function} props.onStateChange - Called when navigation state changes
 * @param {function} props.onDone - Called when user clicks Done (all files confirmed)
 * @param {function} props.onExit - Called when user exits review
 * @param {function} props.onConfirmFile - Called when a file is confirmed
 * @param {function} props.onUnconfirmFile - Called when a file is unconfirmed
 * @param {function} props.onRemoveFile - Called when a file is removed
 * @param {function} props.onEditFile - Called when file metadata is edited
 */

import React, { useEffect, useCallback } from 'react';
import { SongCard, NavigationControls } from './components';
import { useReviewNavigation, useAudioPlayer } from './hooks';
import { useKeyboardShortcut } from '../../../../hooks';
import MetadataForm from '../MetadataForm';
import styles from './ReviewScreen.module.css';

export default function ReviewScreen({
  files,
  initialState,
  onStateChange,
  onDone,
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
    initialState,
    onStateChange,
  });

  // Audio player hook
  const audio = useAudioPlayer();

  // Register Shift+Enter keyboard shortcut for confirm
  useKeyboardShortcut('Enter', navigation.confirmCurrent, { shift: true });

  // Stop audio and clear errors when file changes
  useEffect(() => {
    audio.stop();
    audio.clearError();
  }, [navigation.currentFile?.trackingId]);

  // Handle Done button click
  const handleDone = useCallback(() => {
    audio.stop();
    onDone();
  }, [audio, onDone]);

  // Handle Exit button click - exits immediately (confirmed files are already saved)
  const handleExit = useCallback(() => {
    audio.stop();
    onExit();
  }, [audio, onExit]);

  // Calculate unconfirmed count for Done button tooltip
  const unconfirmedCount = navigation.totalFiles - navigation.confirmedCount;

  // If no files, show empty state
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
        <div className={styles.headerActions}>
          {/* Exit button - always visible */}
          <button 
            className={styles.exitButton} 
            onClick={handleExit}
          >
            Exit
          </button>
          {/* Done button - only enabled when all confirmed */}
          <button 
            className={styles.doneButton} 
            onClick={handleDone}
            disabled={!navigation.allConfirmed}
            title={navigation.allConfirmed ? 'Proceed to save' : `${unconfirmedCount} file${unconfirmedCount === 1 ? '' : 's'} still need confirmation`}
          >
            Done
          </button>
        </div>
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
          /* View mode with slide animation */
          <div 
            key={navigation.currentFile.trackingId}
            className={`${styles.songCardWrapper} ${
              navigation.slideDirection === 'left' ? styles.slideInFromRight :
              navigation.slideDirection === 'right' ? styles.slideInFromLeft : ''
            }`}
            onAnimationEnd={navigation.clearSlideDirection}
          >
            <SongCard
              file={navigation.currentFile}
              audio={audio}
            />
          </div>
        )}

        {/* Navigation controls */}
        {!navigation.isEditMode && (
          <NavigationControls navigation={navigation} />
        )}
      </div>
    </div>
  );
}
