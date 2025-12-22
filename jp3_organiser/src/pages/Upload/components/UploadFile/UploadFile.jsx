import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { processAudioFiles, MetadataStatus } from "../../../../services";
import styles from "./UploadFile.module.css";

/**
 * UploadFile Component
 * 
 * Handles audio file selection and metadata extraction.
 * 
 * Flow:
 * 1. User selects files -> assigned trackingId
 * 2. Extract ID3 metadata -> mark as Complete or Incomplete
 * 3. (Future) AI/API cross-checker for missing metadata
 * 4. (Future) Manual confirmation for incomplete metadata
 * 5. (Future) Duplicate detection
 * 6. (Future) Sanitize filenames and save to library
 * 
 * @param {Object} props
 * @param {string} props.libraryPath - The configured library directory path
 */
export default function UploadFile({ libraryPath }) {
  const [trackedFiles, setTrackedFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ complete: 0, incomplete: 0, error: 0 });

  const selectFiles = async () => {
    try {
      setError(null);
      
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

      // Tauri returns string OR array of strings
      const paths = Array.isArray(selected) ? selected : [selected];

      setIsProcessing(true);

      // Process files and extract metadata
      const result = await processAudioFiles(paths);
      
      setTrackedFiles(result.files);
      setStats({
        complete: result.completeCount,
        incomplete: result.incompleteCount,
        error: result.errorCount,
      });
    } catch (err) {
      setError(err.toString());
      console.error("Failed to process files:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const clearFiles = () => {
    setTrackedFiles([]);
    setStats({ complete: 0, incomplete: 0, error: 0 });
    setError(null);
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

          <ul className={styles.fileList}>
            {trackedFiles.map((file) => (
              <li className={styles.fileItem} key={file.trackingId}>
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{file.fileName}</span>
                  <span className={styles.fileMeta}>
                    {formatFileSize(file.fileSize)}
                    {file.metadata?.artist && ` • ${file.metadata.artist}`}
                    {file.metadata?.title && ` - ${file.metadata.title}`}
                  </span>
                </div>
                <div className={styles.fileStatus}>
                  {getStatusBadge(file.metadataStatus)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
