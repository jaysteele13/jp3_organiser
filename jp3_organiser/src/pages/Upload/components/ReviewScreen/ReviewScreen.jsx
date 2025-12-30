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
 * - "Exit" button: Always available, shows confirmation if unconfirmed files exist
 * 
 * @param {Object} props
 * @param {Array} props.files - Files to review
 * @param {Object} props.initialState - Initial navigation state { currentIndex, isEditMode }
 * @param {function} props.onStateChange - Called when navigation state changes
 * @param {function} props.onDone - Called when user clicks Done (all files confirmed)
 * @param {function} props.onExit - Called when user exits (may have unconfirmed files)
 * @param {function} props.onConfirmFile - Called when a file is confirmed
 * @param {function} props.onUnconfirmFile - Called when a file is unconfirmed
 * @param {function} props.onRemoveFile - Called when a file is removed
 * @param {function} props.onEditFile - Called when file metadata is edited
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SongCard, NavigationControls } from './components';
import { useReviewNavigation, useAudioPlayer } from './hooks';
import { useKeyboardShortcut } from '../../../../hooks';
import { ConfirmModal } from '../../../../components';
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
  // DEBUG: Log files received on every render
  console.log('[ReviewScreen] Render - files:', files?.length, 'initialState:', initialState);
  console.log('[ReviewScreen] File details:', files?.map(f => ({ 
    id: f.trackingId?.slice(0, 8), 
    status: f.metadataStatus, 
    confirmed: f.isConfirmed,
    title: f.metadata?.title 
  })));

  // State for exit confirmation modal
  const [showExitConfirm, setShowExitConfirm] = useState(false);

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

  // Stop audio when file changes
  useEffect(() => {
    audio.stop();
  }, [navigation.currentFile?.trackingId]);

  // Handle Done button click
  const handleDone = useCallback(() => {
    audio.stop();
    onDone();
  }, [audio, onDone]);

  // Handle Exit button click - show confirmation if unconfirmed files exist
  const handleExitClick = useCallback(() => {
    if (navigation.allConfirmed) {
      // All confirmed, exit directly
      audio.stop();
      onExit();
    } else {
      // Has unconfirmed files, show confirmation modal
      setShowExitConfirm(true);
    }
  }, [navigation.allConfirmed, audio, onExit]);

  // Handle confirm exit (from modal)
  const handleConfirmExit = useCallback(() => {
    setShowExitConfirm(false);
    audio.stop();
    onExit();
  }, [audio, onExit]);

  // Handle cancel exit (from modal)
  const handleCancelExit = useCallback(() => {
    setShowExitConfirm(false);
  }, []);

  // Calculate unconfirmed count for modal message
  const unconfirmedCount = navigation.totalFiles - navigation.confirmedCount;

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
      {/* Exit confirmation modal */}
      {showExitConfirm && (
        <ConfirmModal
          title="Exit Review?"
          message={`You have ${unconfirmedCount} unconfirmed file${unconfirmedCount === 1 ? '' : 's'}. Unconfirmed files will not be added to your library.`}
          confirmLabel="Exit Anyway"
          cancelLabel="Keep Reviewing"
          variant="warning"
          onConfirm={handleConfirmExit}
          onCancel={handleCancelExit}
        />
      )}

      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Review Song Details</h2>
        <div className={styles.headerActions}>
          {/* Exit button - always visible */}
          <button 
            className={styles.exitButton} 
            onClick={handleExitClick}
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
            confirmedCount={navigation.confirmedCount}
            canGoPrevious={navigation.canGoPrevious}
            canGoNext={navigation.canGoNext}
            isConfirmed={navigation.currentFile.isConfirmed}
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
