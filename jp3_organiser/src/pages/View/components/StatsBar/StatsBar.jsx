import { useState, useEffect, useCallback } from 'react';
import { getLibraryStats, compactLibrary } from '../../../../services/libraryService';
import { formatFileSize } from '../../../../utils/formatters';
import { ConfirmModal } from '../../../../components';
import styles from './StatsBar.module.css';

/**
 * StatsBar Component
 * 
 * Displays library statistics and compaction controls.
 * Shows a warning when there are deleted songs that need compaction.
 * 
 * @param {Object} props
 * @param {Object} props.stats - Basic stats (songs, albums, artists, playlists)
 * @param {string} props.libraryPath - Library path for fetching detailed stats
 * @param {Function} props.onCompacted - Callback when compaction completes
 */
export default function StatsBar({ stats, libraryPath, onCompacted }) {
  const [libraryStats, setLibraryStats] = useState(null);
  const [isCompacting, setIsCompacting] = useState(false);
  const [showCompactModal, setShowCompactModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [compactResult, setCompactResult] = useState(null);

  // Fetch detailed library stats
  useEffect(() => {
    if (!libraryPath) return;
    
    getLibraryStats(libraryPath)
      .then(setLibraryStats)
      .catch(err => console.error('Failed to get library stats:', err));
  }, [libraryPath, stats]); // Refetch when stats change (after delete/refresh)

  const handleCompactClick = useCallback(() => {
    setShowCompactModal(true);
  }, []);

  const handleConfirmCompact = useCallback(async () => {
    if (!libraryPath) return;
    
    setIsCompacting(true);
    try {
      const result = await compactLibrary(libraryPath);
      setCompactResult(result);
      setShowCompactModal(false);
      setShowResultModal(true);
      // Refresh stats after compaction
      const newStats = await getLibraryStats(libraryPath);
      setLibraryStats(newStats);
      // Notify parent to refresh library data
      if (onCompacted) {
        onCompacted(result);
      }
    } catch (err) {
      console.error('Failed to compact library:', err);
      setCompactResult({ error: err.toString() });
      setShowCompactModal(false);
      setShowResultModal(true);
    } finally {
      setIsCompacting(false);
    }
  }, [libraryPath, onCompacted]);

  const handleCancelCompact = useCallback(() => {
    if (isCompacting) return;
    setShowCompactModal(false);
  }, [isCompacting]);

  const handleCloseResult = useCallback(() => {
    setShowResultModal(false);
    setCompactResult(null);
  }, []);

  const deletedSongs = libraryStats?.deletedSongs ?? 0;
  const needsCompaction = deletedSongs > 0;

  return (
    <>
      <div className={styles.statsBar}>
        <div className={styles.statsLeft}>
          <span className={styles.stat}>{stats.songs} songs</span>
          <span className={styles.stat}>{stats.albums} albums</span>
          <span className={styles.stat}>{stats.artists} artists</span>
          <span className={styles.stat}>{stats.playlists} playlists</span>
        </div>
        
        {needsCompaction && (
          <div className={styles.compactWarning}>
            <span className={styles.warningText} title={`${deletedSongs} deleted songs need compaction`}>
              {deletedSongs}
            </span>
            <button 
              className={styles.compactBtn}
              onClick={handleCompactClick}
              disabled={isCompacting}
            >
              {isCompacting ? 'Compacting...' : 'Compact Library'}
            </button>
          </div>
        )}
      </div>

      {/* Compact Confirmation Modal */}
      {showCompactModal && (
        <ConfirmModal
          title="Compact Library"
          message={`This will permanently remove ${deletedSongs} deleted song${deletedSongs !== 1 ? 's' : ''} from the library metadata and update all playlists.`}
          confirmLabel={isCompacting ? 'Compacting...' : 'Compact Now'}
          cancelLabel="Cancel"
          variant="warning"
          onConfirm={handleConfirmCompact}
          onCancel={handleCancelCompact}
          isLoading={isCompacting}
        >
          <div className={styles.infoBox}>
            <strong>What gets rewritten:</strong>
            <ul>
              <li>library.bin (metadata only, ~{formatFileSize(libraryStats?.fileSizeBytes || 0)})</li>
              <li>All playlist files (song IDs remapped)</li>
            </ul>
            <strong>What stays untouched:</strong>
            <ul>
              <li>Audio files (already deleted when songs were removed)</li>
            </ul>
          </div>
          <p className={styles.warning}>
            Run this before syncing to your lil jp3 / microSD card.
          </p>
        </ConfirmModal>
      )}

      {/* Result Modal */}
      {showResultModal && compactResult && (
        <ConfirmModal
          title={compactResult.error ? 'Compaction Failed' : 'Compaction Complete'}
          confirmLabel="Done"
          cancelLabel=""
          variant="default"
          onConfirm={handleCloseResult}
          onCancel={handleCloseResult}
        >
          {compactResult.error ? (
            <p className={styles.error}>{compactResult.error}</p>
          ) : (
            <>
              <div className={styles.resultBox}>
                <p><strong>Removed:</strong></p>
                <ul>
                  <li>{compactResult.songsRemoved} songs</li>
                  <li>{compactResult.artistsRemoved} orphaned artists</li>
                  <li>{compactResult.albumsRemoved} orphaned albums</li>
                  <li>{compactResult.stringsRemoved} unused strings</li>
                </ul>
                <p><strong>Updated:</strong></p>
                <ul>
                  <li>{compactResult.playlistsUpdated} playlists</li>
                </ul>
                <p><strong>Space saved:</strong> {formatFileSize(compactResult.bytesSaved)}</p>
              </div>
              <p className={styles.success}>
                Your library is now ready to sync to lil jp3.
              </p>
            </>
          )}
        </ConfirmModal>
      )}
    </>
  );
}
