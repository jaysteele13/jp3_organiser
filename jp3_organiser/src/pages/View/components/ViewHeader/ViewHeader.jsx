
import styles from './ViewHeader.module.css'
export default function ViewHeader({ libraryPath, handleRefresh, isLoading }) {


    return (
        <>
        <header className={styles.header}>
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