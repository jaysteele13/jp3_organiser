/**
 * FilterBar Component
 * 
 * A reusable filter indicator bar shown when viewing a filtered subset of items.
 * Displays what is being filtered and provides a clear button.
 * 
 * @param {Object} props
 * @param {string} props.label - Main label text (e.g., "Song Title")
 * @param {string} props.sublabel - Optional secondary text (e.g., "by Artist Name")
 * @param {Function} props.onClear - Callback when clear button is clicked
 * @param {string} props.clearText - Text for clear button (default: "Show all")
 */

import styles from './FilterBar.module.css';

export default function FilterBar({ label, sublabel, onClear, clearText = 'Show all' }) {
  return (
    <div className={styles.filterBar}>
      <span className={styles.filterText}>
        Showing: <strong>{label}</strong>
        {sublabel && <span className={styles.sublabel}> {sublabel}</span>}
      </span>
      <button 
        className={styles.clearButton}
        onClick={onClear}
        type="button"
      >
        {clearText}
      </button>
    </div>
  );
}
