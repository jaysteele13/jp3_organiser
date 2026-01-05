/**
 * UploadModeSelector Component
 * 
 * Displays four mode options for adding music:
 * - Add Songs: Auto-detect everything via AcousticID
 * - Add Album: User specifies album + artist upfront
 * - Add Artist: User specifies artist upfront
 * - Add Playlist: User specifies playlist name, songs added to new playlist
 * 
 * @param {Object} props
 * @param {function} props.onSelectSongs - Called when "Add Songs" is selected
 * @param {function} props.onSelectAlbum - Called when "Add Album" is selected
 * @param {function} props.onSelectArtist - Called when "Add Artist" is selected
 * @param {function} props.onSelectPlaylist - Called when "Add Playlist" is selected
 */

import styles from './UploadModeSelector.module.css';

export default function UploadModeSelector({ 
  onSelectSongs, 
  onSelectAlbum, 
  onSelectArtist,
  onSelectPlaylist,
}) {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>How would you like to add music?</h3>
      
      <div className={styles.modeGrid}>
        {/* Add Songs - default behavior */}
        <button 
          className={`${styles.modeCard}`}
          onClick={onSelectSongs}
        >
          <span className={styles.modeIcon}>♪</span>
          <span className={styles.modeLabel}>Add Songs</span>
          <span className={styles.modeDescription}>
            Auto-detect metadata via audio fingerprinting
          </span>
        </button>

        {/* Add Album */}
        <button 
          className={`${styles.modeCard}`}
          onClick={onSelectAlbum}
        >
          <span className={styles.modeIcon}>○</span>
          <span className={styles.modeLabel}>Add Album</span>
          <span className={styles.modeDescription}>
            You specify album and artist
          </span>
        </button>

        {/* Add Artist */}
        <button 
          className={`${styles.modeCard}`}
          onClick={onSelectArtist}
        >
          <span className={styles.modeIcon}>♫</span>
          <span className={styles.modeLabel}>Add Artist</span>
          <span className={styles.modeDescription}>
            You specify artist only
          </span>
        </button>

        {/* Add Playlist */}
        <button 
          className={`${styles.modeCard}`}
          onClick={onSelectPlaylist}
        >
          <span className={styles.modeIcon}>☰</span>
          <span className={styles.modeLabel}>Add Playlist</span>
          <span className={styles.modeDescription}>
            Create a new playlist with songs
          </span>
        </button>
      </div>

      <p className={styles.hint}>
        All modes use audio fingerprinting to identify songs. 
        Album and Artist modes override unreliable API results with your input.
      </p>
    </div>
  );
}
