import React, { useState, useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { processAudioFiles, MetadataStatus, saveToLibrary } from "../../../../services";
import MetadataForm from "../MetadataForm";
import styles from "./UploadFile.module.css";

/**
 * UploadFile Component
 * 
 * Handles audio file selection, metadata extraction, and manual completion.
 * 
 * Flow:
 * 1. User selects files -> assigned trackingId
 * 2. Extract ID3 metadata -> mark as Complete or Incomplete
 * 3. (Future) AI/API cross-checker for missing metadata
 * 4. Manual confirmation for incomplete metadata
 * 5. (Future) Duplicate detection
 * 6. (Future) Sanitize filenames and save to library
 * 
 * @param {Object} props
 * @param {string} props.libraryPath - The configured library directory path
 */
export default function UploadFile({ libraryPath }) {
  const [trackedFiles, setTrackedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [editingFileId, setEditingFileId] = useState(null);
  const [showReviewMode, setShowReviewMode] = useState(false);
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);

  // Calculate stats from current files
  const stats = useMemo(() => {
    return {
      complete: trackedFiles.filter(f => f.metadataStatus === MetadataStatus.COMPLETE).length,
      incomplete: trackedFiles.filter(f => f.metadataStatus === MetadataStatus.INCOMPLETE).length,
      error: trackedFiles.filter(f => f.metadataStatus === MetadataStatus.ERROR).length,
    };
  }, [trackedFiles]);

  // Get incomplete files for review
  const incompleteFiles = useMemo(() => {
    return trackedFiles.filter(f => f.metadataStatus === MetadataStatus.INCOMPLETE);
  }, [trackedFiles]);

  // Check if all files are ready (complete or skipped)
  const allFilesReady = useMemo(() => {
    return trackedFiles.length > 0 && stats.incomplete === 0;
  }, [trackedFiles, stats.incomplete]);

  const selectFiles = async () => {
    try {
      setError(null);
      setEditingFileId(null);
      setShowReviewMode(false);
      
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [
          {
            name: "Audio Files",
            extensions: ["mp3", "wav", "flac", "m4a", "ogg"],
          },
        ],
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];

      setIsProcessing(true);

      const result = await processAudioFiles(paths);
      
      setTrackedFiles(result.files);
    } catch (err) {
      setError(err.toString());
      console.error("Failed to process files:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearFiles = () => {
    setTrackedFiles([]);
    setError(null);
    setSuccessMessage(null);
    setEditingFileId(null);
    setShowReviewMode(false);
    setCurrentReviewIndex(0);
  };

  // Save metadata for a single file
  const handleSaveMetadata = (trackingId, metadata) => {
    setTrackedFiles(prev => prev.map(file => {
      if (file.trackingId === trackingId) {
        return {
          ...file,
          metadata: {
            ...file.metadata,
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
          },
          metadataStatus: MetadataStatus.COMPLETE,
        };
      }
      return file;
    }));

    // Move to next incomplete file in review mode
    if (showReviewMode) {
      const remainingIncomplete = incompleteFiles.filter(f => f.trackingId !== trackingId);
      if (remainingIncomplete.length > 0) {
        const nextIndex = Math.min(currentReviewIndex, remainingIncomplete.length - 1);
        setCurrentReviewIndex(nextIndex);
      } else {
        setShowReviewMode(false);
      }
    } else {
      setEditingFileId(null);
    }
  };

  // Skip a file (remove from list)
  const handleSkipFile = (trackingId) => {
    setTrackedFiles(prev => prev.filter(f => f.trackingId !== trackingId));
    
    if (showReviewMode) {
      const remainingIncomplete = incompleteFiles.filter(f => f.trackingId !== trackingId);
      if (remainingIncomplete.length <= 1) {
        setShowReviewMode(false);
      } else {
        setCurrentReviewIndex(prev => Math.min(prev, remainingIncomplete.length - 2));
      }
    } else {
      setEditingFileId(null);
    }
  };

  // Start reviewing all incomplete files
  const startReviewMode = () => {
    setShowReviewMode(true);
    setCurrentReviewIndex(0);
    setEditingFileId(null);
  };

  // Cancel review mode
  const cancelReviewMode = () => {
    setShowReviewMode(false);
    setCurrentReviewIndex(0);
  };

  // Edit a specific file
  const editFile = (trackingId) => {
    setEditingFileId(trackingId);
    setShowReviewMode(false);
  };

  // Add all complete files to the library
  const handleAddToLibrary = async () => {
    if (!libraryPath) {
      setError("Library path not configured");
      return;
    }

    const completeFiles = trackedFiles.filter(
      f => f.metadataStatus === MetadataStatus.COMPLETE
    );

    if (completeFiles.length === 0) {
      setError("No complete files to add");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Transform to the format expected by the backend
      const filesToSave = completeFiles.map(f => ({
        sourcePath: f.filePath,
        metadata: f.metadata,
      }));

      const result = await saveToLibrary(libraryPath, filesToSave);

      setSuccessMessage(
        `Added ${result.filesSaved} file(s) to library. ` +
        `${result.artistsAdded} artist(s), ${result.albumsAdded} album(s), ${result.songsAdded} song(s).`
      );

      // Clear the saved files from the list
      setTrackedFiles(prev => 
        prev.filter(f => f.metadataStatus !== MetadataStatus.COMPLETE)
      );
    } catch (err) {
      setError(`Failed to save to library: ${err}`);
      console.error("Failed to save to library:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case MetadataStatus.COMPLETE:
        return <span className={styles.statusComplete}>Complete</span>;
      case MetadataStatus.INCOMPLETE:
        return <span className={styles.statusIncomplete}>Incomplete</span>;
      case MetadataStatus.ERROR:
        return <span className={styles.statusError}>Error</span>;
      case MetadataStatus.PENDING:
      default:
        return <span className={styles.statusPending}>Pending</span>;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get file being edited
  const editingFile = editingFileId 
    ? trackedFiles.find(f => f.trackingId === editingFileId)
    : null;

  // Get current file in review mode
  const currentReviewFile = showReviewMode && incompleteFiles.length > 0
    ? incompleteFiles[currentReviewIndex]
    : null;

  return (
    <div className={styles.uploadContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Select Audio Files</h3>
        <p className={styles.hint}>
          Files will be scanned for ID3 metadata. Complete files have artist, album, and title.
        </p>
      </div>

      <div className={styles.actions}>
        <button 
          className={styles.selectButton} 
          onClick={selectFiles}
          disabled={isProcessing}
        >
          {isProcessing ? "Processing..." : "Select Audio Files"}
        </button>
        
        {trackedFiles.length > 0 && (
          <button 
            className={styles.clearButton}
            onClick={clearFiles}
            disabled={isProcessing}
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className={styles.error}>{error}</div>
      )}

      {successMessage && (
        <div className={styles.successMessage}>{successMessage}</div>
      )}

      {trackedFiles.length > 0 && (
        <div className={styles.fileListContainer}>
          <div className={styles.statsBar}>
            <span className={styles.statItem}>
              {trackedFiles.length} file(s)
            </span>
            {stats.complete > 0 && (
              <span className={styles.statComplete}>
                {stats.complete} complete
              </span>
            )}
            {stats.incomplete > 0 && (
              <span className={styles.statIncomplete}>
                {stats.incomplete} incomplete
              </span>
            )}
            {stats.error > 0 && (
              <span className={styles.statError}>
                {stats.error} error(s)
              </span>
            )}
          </div>

          {/* Review incomplete files button */}
          {stats.incomplete > 0 && !showReviewMode && !editingFileId && (
            <button 
              className={styles.reviewButton}
              onClick={startReviewMode}
            >
              Review {stats.incomplete} incomplete file(s)
            </button>
          )}

          {/* All files ready message and Add to Library button */}
          {allFilesReady && (
            <div className={styles.readyContainer}>
              <div className={styles.readyMessage}>
                All files have complete metadata and are ready to be added to the library.
              </div>
              <button 
                className={styles.addToLibraryButton}
                onClick={handleAddToLibrary}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : `Add ${stats.complete} file(s) to Library`}
              </button>
            </div>
          )}

          {/* Some files ready - show Add to Library option */}
          {!allFilesReady && stats.complete > 0 && !showReviewMode && !editingFileId && (
            <button 
              className={styles.addToLibraryButtonSecondary}
              onClick={handleAddToLibrary}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : `Add ${stats.complete} complete file(s) to Library`}
            </button>
          )}

          {/* Review mode form */}
          {showReviewMode && currentReviewFile && (
            <div className={styles.reviewContainer}>
              <div className={styles.reviewHeader}>
                <span className={styles.reviewProgress}>
                  File {currentReviewIndex + 1} of {incompleteFiles.length}
                </span>
                <button 
                  className={styles.reviewCancelButton}
                  onClick={cancelReviewMode}
                >
                  Exit Review
                </button>
              </div>
              <MetadataForm
                file={currentReviewFile}
                onSave={handleSaveMetadata}
                onSkip={handleSkipFile}
              />
            </div>
          )}

          {/* Single file edit form */}
          {editingFile && !showReviewMode && (
            <MetadataForm
              file={editingFile}
              onSave={handleSaveMetadata}
              onCancel={() => setEditingFileId(null)}
              onSkip={handleSkipFile}
            />
          )}

          {/* File list */}
          <ul className={styles.fileList}>
            {trackedFiles.map((file) => (
              <li 
                className={`${styles.fileItem} ${file.trackingId === editingFileId ? styles.fileItemActive : ''}`} 
                key={file.trackingId}
              >
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{file.fileName}</span>
                  <span className={styles.fileMeta}>
                    {formatFileSize(file.fileSize)}
                    {file.metadata?.artist && ` • ${file.metadata.artist}`}
                    {file.metadata?.title && ` - ${file.metadata.title}`}
                  </span>
                </div>
                <div className={styles.fileActions}>
                  {file.metadataStatus === MetadataStatus.INCOMPLETE && !showReviewMode && (
                    <button 
                      className={styles.editButton}
                      onClick={() => editFile(file.trackingId)}
                    >
                      Edit
                    </button>
                  )}
                  <div className={styles.fileStatus}>
                    {getStatusBadge(file.metadataStatus)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
