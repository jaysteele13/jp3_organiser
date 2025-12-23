import styles from './StatsBar.module.css'
export default function StatsBar({stats}) {

    return (
        
         <div className={styles.statsBar}>
                    <span className={styles.stat}>{stats.songs} songs</span>
                    <span className={styles.stat}>{stats.albums} albums</span>
                    <span className={styles.stat}>{stats.artists} artists</span>
        </div>
        
    )
}