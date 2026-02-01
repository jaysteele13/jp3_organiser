/**
 * SongCard Component
 * 
 * Displays the current song being reviewed with metadata,
 * audio player, and file information.
 * 
 * @param {Object} props
 * @param {Object} props.file - The audio file to display
 * @param {Object} props.audio - Audio controller object from useAudioPlayer hook
 */

import React from 'react';
import MetadataDisplay from './MetadataDisplay';
import AudioPlayer from './AudioPlayer';
import { formatFileSize } from '../../../../../utils';
import styles from '../ReviewScreen.module.css';



/**
 * Get human-readable label for metadata source.
 * @param {string} source - Metadata source value
 * @returns {string} Display label
 */



export default function SongCard({ file, audio }) {
  if (!file) return null;

function getStatusDisplay(metadataStatus, isConfirmed) {
  if (isConfirmed) {
    return { label: 'Confirmed', className: 'statusconfirmed' };
  }
  if (metadataStatus === 'complete') {
    return { label: 'Automated', className: 'statusautomated' };
  }
  return { label: 'Incomplete', className: 'statusincomplete' };
}

  const { metadataSource, metadataStatus, isConfirmed } = file;
  const isAutomated = metadataSource === 'id3' || metadataSource === 'fingerprint';
    const statusDisplay = getStatusDisplay(metadataStatus, isConfirmed);

  return (
    <div className={styles.songCard}>
      {/* File header and status */}
      <div className={styles.songHeader}>
        <div className={styles.songFileInfoRow}>
          <div className={styles.songFileNameColumn}>
            <h3 className={styles.songFileName}>{file.fileName}</h3>
            <span className={styles.songFileInfo}>
              {file.fileExtension.toUpperCase()} &bull; {formatFileSize(file.fileSize)}
            </span>
          </div>
          {/* Automated indicator */}
          <div className={styles.songFileSourceColumn}>
          <div className={styles.sourceIndicator}>
            {statusDisplay.label == 'Confirmed' && (
            <span className={`${styles.sourceTag} ${styles.sourceConfirmed}`}>
              Confirmed
            </span>
             )}
            <span className={`${styles.sourceTag} ${isAutomated ? styles.sourceAutomated : styles.sourceManual}`}>
              {isAutomated ? 'Automated' : 'Manual'}
            </span>
             
            </div>
          </div>
        </div>
      </div>

      {/* Metadata display */}
      <MetadataDisplay file={file} />

      {/* Audio player */}
      <AudioPlayer
        filePath={file.filePath}
        fallbackDuration={file.metadata?.durationSecs}
        audio={audio}
      />
    </div>
  );
}
