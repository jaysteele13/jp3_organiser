/**
 * LibrarySearch Component
 * 
 * Reusable search bar with dropdown results for library entities.
 * Searches across playlists, artists, albums, and songs.
 * 
 * Props:
 * - library: Library data object
 * - libraryPath: Path to library for cover art loading
 * - onSelectPlaylist: Callback when playlist is selected
 * - onSelectArtist: Callback when artist is selected
 * - onSelectAlbum: Callback when album is selected
 * - onSelectSong: Callback when song is selected
 * - placeholder: Search input placeholder text
 * - className: Additional CSS class for container
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLibrarySearch, SEARCH_CATEGORY } from '../../hooks/useLibrarySearch';
import SearchResultCard from './SearchResultCard';
import styles from './LibrarySearch.module.css';

// Category display labels
const CATEGORY_LABELS = {
  [SEARCH_CATEGORY.PLAYLIST]: 'Playlists',
  [SEARCH_CATEGORY.ARTIST]: 'Artists',
  [SEARCH_CATEGORY.ALBUM]: 'Albums',
  [SEARCH_CATEGORY.SONG]: 'Songs',
};

export default function LibrarySearch({
  library,
  libraryPath,
  onSelectPlaylist,
  onSelectArtist,
  onSelectAlbum,
  onSelectSong,
  placeholder = 'Search library...',
  className = '',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  
  const searchResults = useLibrarySearch(library, searchQuery);
  const { playlists, artists, albums, songs, hasResults, flatResults } = searchResults;
  
  // Handle selection based on item category
  const handleSelect = useCallback((item) => {
    switch (item.category) {
      case SEARCH_CATEGORY.PLAYLIST:
        onSelectPlaylist?.(item);
        break;
      case SEARCH_CATEGORY.ARTIST:
        onSelectArtist?.(item);
        break;
      case SEARCH_CATEGORY.ALBUM:
        onSelectAlbum?.(item);
        break;
      case SEARCH_CATEGORY.SONG:
        onSelectSong?.(item);
        break;
    }
    
    // Clear search and close dropdown after selection
    setSearchQuery('');
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, [onSelectPlaylist, onSelectArtist, onSelectAlbum, onSelectSong]);
  
  // Handle input change
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsOpen(value.trim().length > 0);
    setHighlightedIndex(-1);
  };
  
  // Handle clear button
  const handleClear = () => {
    setSearchQuery('');
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };
  
  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || flatResults.length === 0) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev < flatResults.length - 1 ? prev + 1 : 0
        );
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => 
          prev > 0 ? prev - 1 : flatResults.length - 1
        );
        break;
      
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < flatResults.length) {
          handleSelect(flatResults[highlightedIndex]);
        }
        break;
      
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Handle focus
  const handleFocus = () => {
    if (searchQuery.trim().length > 0) {
      setIsOpen(true);
    }
  };
  
  // Render a category section with results
  const renderCategory = (categoryKey, items) => {
    if (items.length === 0) return null;
    
    // Calculate the starting index in flatResults for this category
    let startIndex = 0;
    if (categoryKey === SEARCH_CATEGORY.ARTIST) {
      startIndex = playlists.length;
    } else if (categoryKey === SEARCH_CATEGORY.ALBUM) {
      startIndex = playlists.length + artists.length;
    } else if (categoryKey === SEARCH_CATEGORY.SONG) {
      startIndex = playlists.length + artists.length + albums.length;
    }
    
    return (
      <div className={styles.categorySection} key={categoryKey}>
        <div className={styles.categoryHeader}>
          {CATEGORY_LABELS[categoryKey]}
        </div>
        <div className={styles.categoryResults}>
          {items.map((item, index) => (
            <SearchResultCard
              key={`${categoryKey}-${item.id}`}
              item={item}
              libraryPath={libraryPath}
              isHighlighted={highlightedIndex === startIndex + index}
              onClick={handleSelect}
            />
          ))}
        </div>
      </div>
    );
  };
  
  const showDropdown = isOpen && searchQuery.trim().length > 0;
  
  return (
    <div 
      ref={containerRef} 
      className={`${styles.container} ${className}`}
    >
      <div className={styles.inputWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          aria-label="Search library"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
        {searchQuery && (
          <button
            className={styles.clearBtn}
            onClick={handleClear}
            aria-label="Clear search"
            type="button"
          >
            ×
          </button>
        )}
      </div>
      
      {showDropdown && (
        <div 
          className={styles.dropdown}
          role="listbox"
          aria-label="Search results"
        >
          {hasResults ? (
            <>
              {renderCategory(SEARCH_CATEGORY.PLAYLIST, playlists)}
              {renderCategory(SEARCH_CATEGORY.ARTIST, artists)}
              {renderCategory(SEARCH_CATEGORY.ALBUM, albums)}
              {renderCategory(SEARCH_CATEGORY.SONG, songs)}
            </>
          ) : (
            <div className={styles.noResults}>
              No results found for "{searchQuery}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
