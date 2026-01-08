import styles from './TabSelector.module.css'

export default function TabSelector({setActiveTab, activeTab, tabs }) {

    return (
         <div className={styles.tabs}>
            {Object.entries(tabs).map(([key, value]) => (
                <button
                key={value}
                className={`${styles.tab} ${activeTab === value ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(value)}
                >
                {key.charAt(0) + key.slice(1).toLowerCase()}
                </button>
            ))}
        </div>
    )
}