import React, { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import styles from "./UploadFile.module.css";

/**
 * UploadFile Component
 * 
 * Handles audio file selection for processing.
 * 
 * Future flow:
 * 1. User selects files -> assigned temporaryTrackingId
 * 2. Extract ID3 metadata -> mark as metadata-complete or metadata-incomplete
 * 3. (Future) AI/API cross-checker for missing metadata
 * 4. Manual confirmation for incomplete metadata
 * 5. Duplicate detection
 * 6. Sanitize filenames and save to library
 * 
 * @param {Object} props
 * @param {string} props.libraryPath - The configured library directory path
 */
export default function UploadFile({ libraryPath }) {
  const [files, setFiles] = useState([]);

  const selectFiles = async () => {
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

    // Save only file names (not full paths)
    const fileNames = paths.map((path) => {
      return path.split(/[/\\]/).pop();
    });

    setFiles(fileNames);
  };

  return (
    <div className={styles.uploadContainer}>
      <div className={styles.header}>
        <h3 className={styles.title}>Select Audio Files</h3>
        <p className={styles.hint}>
          For best results, ensure your files have ID3 tags with artist, album, and title information.
        </p>
      </div>

      <button className={styles.selectButton} onClick={selectFiles}>
        Select Audio Files
      </button>

      {files.length > 0 && (
        <div className={styles.fileListContainer}>
          <p className={styles.fileCount}>{files.length} file(s) selected</p>
          <ul className={styles.fileList}>
            {files.map((file, index) => (
              <li className={styles.fileItem} key={index}>{file}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
