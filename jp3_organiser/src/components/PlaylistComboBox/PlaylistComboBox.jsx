/**
 * PlaylistComboBox
 * 
 * Searchable dropdown for selecting an existing playlist.
 * Features:
 * - Search/filter playlists by name
 * - Shows song count for each playlist
 * - Keyboard navigation support
 * - Click outside to close
 * 
 * @param {Object} props
 * @param {Array} props.playlists - Array of playlist objects { id, name, songCount }
 * @param {Object|null} props.selectedPlaylist - Currently selected playlist or null
 * @param {function} props.onSelect - Called with playlist object when selected
 * @param {string} props.placeholder - Placeholder text (default: "Search playlists...")
 * @param {boolean} props.disabled - If true, combobox is disabled
 * @param {boolean} props.isLoading - If true, shows loading state
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './PlaylistComboBox.module.css';

export default function PlaylistComboBox({
  playlists = [],
  selectedPlaylist = null,
  onSelect,
  placeholder = 'Search playlists...',
  disabled = false,
  isLoading = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Filter playlists based on search term
  const filteredPlaylists = playlists.filter((playlist) =>
    playlist.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlightedItem = listRef.current.children[highlightedIndex];
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleSelect = useCallback((playlist) => {
    onSelect(playlist);
    setSearchTerm('');
    setIsOpen(false);
  }, [onSelect]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredPlaylists.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredPlaylists[highlightedIndex]) {
          handleSelect(filteredPlaylists[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onSelect(null);
    setSearchTerm('');
    inputRef.current?.focus();
  };

  return (
    <div 
      className={`${styles.container} ${disabled ? styles.disabled : ''}`} 
      ref={containerRef}
    >
      <div className={styles.inputWrapper}>
        <span className={styles.searchIcon}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </span>
        
        {selectedPlaylist && !isOpen ? (
          <div className={styles.selectedValue} onClick={() => !disabled && setIsOpen(true)}>
            <span className={styles.playlistIcon}>&#9835;</span>
            <span className={styles.playlistName}>{selectedPlaylist.name}</span>
            <span className={styles.songCount}>({selectedPlaylist.songCount})</span>
            <button 
              className={styles.clearBtn} 
              onClick={handleClear}
              type="button"
              disabled={disabled}
            >
              &times;
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            value={searchTerm}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
          />
        )}
        
        <span 
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>

      {isOpen && (
        <ul className={styles.dropdown} ref={listRef}>
          {isLoading ? (
            <li className={styles.loadingItem}>Loading playlists...</li>
          ) : filteredPlaylists.length === 0 ? (
            <li className={styles.emptyItem}>
              {playlists.length === 0 
                ? 'No playlists available' 
                : 'No matching playlists'}
            </li>
          ) : (
            filteredPlaylists.map((playlist, index) => (
              <li
                key={playlist.id}
                className={`${styles.item} ${index === highlightedIndex ? styles.highlighted : ''} ${
                  selectedPlaylist?.id === playlist.id ? styles.selected : ''
                }`}
                onClick={() => handleSelect(playlist)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span className={styles.playlistIcon}>&#9835;</span>
                <span className={styles.playlistName}>{playlist.name}</span>
                <span className={styles.songCount}>({playlist.songCount})</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
