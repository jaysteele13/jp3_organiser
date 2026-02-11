
import { useState } from 'react';
import { clearCoverCache } from '../../../../services/coverArtService';
import { useToast } from '../../../../hooks/useToast';
import styles from './ViewHeader.module.css'

/**
 * ViewHeader Component
 * 
 * Header for the View page with optional back button when navigating from Player.
 */
export default function ViewHeader({ 
  libraryPath, 
  handleRefresh, 
  isLoading,
  showBackButton = false,
  onBackClick
}) {
  const toast = useToast(5000);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const handleClearCache = async () => {
    if (!libraryPath) {
      toast.showToast('Library path not set', 'error');
      return;
    }

    setIsClearingCache(true);
    try {
      const result = await clearCoverCache(libraryPath);
      if (result.success) {
        const totalCleared = result.albumsCleared + result.artistsCleared;
        
        // Build success message
        let message = '';
        if (totalCleared > 0) {
          message += `Cleared ${totalCleared} cached cover images (${result.albumsCleared} albums, ${result.artistsCleared} artists)`;
        } else {
          message += 'No cached cover images found';
        }
        
        // Add not-found store info
        if (result.notFoundEntriesCleared) {
          message += totalCleared > 0 ? ' and ' : 'Cleared ';
          message += 'not-found cache (allowing API retries)';
        } else if (result.notFoundError) {
          message += '. Failed to clear not-found cache';
        }
        
        toast.showToast(message, totalCleared > 0 ? 'success' : 'info');
      } else {
        toast.showToast(result.error || 'Failed to clear cover cache', 'error');
      }
    } catch (error) {
      console.error('Failed to clear cover cache:', error);
      toast.showToast('Failed to clear cover cache', 'error');
    } finally {
      setIsClearingCache(false);
    }
  };
    return (
        <>
        <header className={styles.header}>
                {showBackButton && (
                  <button 
                    className={styles.backButton}
                    onClick={onBackClick}
                    title="Back to Player"
                  >
                    &larr; jp3 player
                  </button>
                )}
                {/* Library in Primary Font bigger On hover display path. Comment out the debugging lcear cache. Keep Refresh */}
                <div className={styles.headerInfo}>
                  <h1 className={styles.title} 
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  >Library</h1>
                  {isHovering && (
                    <div className={styles.libraryPathDisplay}>
                      <p className={styles.subtitle}>
                        Parsed from: <code>{libraryPath}/jp3/metadata/library.bin</code>
                      </p>
                    </div>
                  )}
                </div>
                {/* REFRESH BUTTON FOR CACHE REMOVE BEFORE FINISHED in CoverArtService.js lib.rs and cover_art.rs */}
                <div className={styles.buttonGroup}>
                  <button 
                    className={styles.clearCacheButton} 
                    onClick={handleClearCache}
                    disabled={isClearingCache || !libraryPath}
                    title="Clear cached cover images and reset not-found cache (useful after API key changes)"
                  >
                    {isClearingCache ? 'Clearing...' : 'Clear Cache'}
                  </button>
                  <button 
                    className={styles.refreshButton} 
                    onClick={handleRefresh}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </header>
        </>
    )
}