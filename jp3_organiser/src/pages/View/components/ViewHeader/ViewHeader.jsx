
import { useState } from 'react';
import { clearCoverCache } from '../../../../services/coverArtService';
import { clearNotFoundCache } from '../../../../services/coverArtNotFoundStore';
import { clearCoverArtCache } from '../../../../components/CoverArt/CoverArt';
import { useToast } from '../../../../hooks/useToast';
import styles from './ViewHeader.module.css'
import { clearMbids } from '../../../../services';

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

      // Clear the JS-side not-found cache (allows API retries)
      // Note: MBIDs are NOT cleared — they're valuable data from upload fingerprinting
    
      await clearNotFoundCache();
        await clearMbids();

      // Flush in-memory blob URL cache so covers re-fetch on next render
      clearCoverArtCache();

      if (result.success) {
        const totalCleared = result.albumsCleared + result.artistsCleared;
        
        // Build success message
        let message = '';
        if (totalCleared > 0) {
          message += `Cleared ${totalCleared} cached images (${result.albumsCleared} albums, ${result.artistsCleared} artists)`;
        } else {
          message += 'No cached cover images found';
        }
        message += '. All caches reset — re-fetching covers...';
        
        toast.showToast(message, 'success');

        // Trigger a library refresh so CoverArt components re-mount
        // and re-fetch through the throttled queue
        handleRefresh();
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
                  <div className={`${styles.libraryPathDisplay} ${isHovering ? styles.libraryPathVisible : ''}`}>
                    <p className={styles.subtitle}>
                      Parsed from: <code>{libraryPath}/jp3/metadata/library.bin</code>
                    </p>
                  </div>
                </div>
                <div className={styles.buttonGroup}>
                  <button 
                    className={styles.refreshButton} 
                    onClick={handleRefresh}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Loading...' : 'Refresh'}
                  </button>
                  {/* <button 
                    className={styles.clearCacheButton} 
                    onClick={handleClearCache}
                    disabled={isClearingCache || !libraryPath}
                    title="Clear cached cover images and reset not-found cache"
                  >
                    {isClearingCache ? 'Clearing...' : '♻ CoverArt'}
                  </button> */}
                </div>
              </header>
        </>
    )
}