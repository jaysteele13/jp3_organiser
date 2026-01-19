
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
    return (
        <>
        <header className={styles.header}>
                {showBackButton && (
                  <button 
                    className={styles.backButton}
                    onClick={onBackClick}
                    title="Back to Player"
                  >
                    &larr;
                  </button>
                )}
                <div className={styles.headerInfo}>
                  <h1 className={styles.title}>Library</h1>
                  <p className={styles.subtitle}>
                    Parsed from: <code>{libraryPath}/jp3/metadata/library.bin</code>
                  </p>
                </div>
                <button 
                  className={styles.refreshButton} 
                  onClick={handleRefresh}
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Refresh'}
                </button>
              </header>
        </>
    )
}