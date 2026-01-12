/**
 * useSongTableState Hook
 * 
 * Manages search, filtering, and pagination state for SongTable component.
 * Supports external state persistence via initialState and onStateChange props.
 * 
 * Features:
 * - Debounced search across title, artist, and album
 * - Pagination with configurable page size
 * - State change callback for persistence (e.g., cache manager)
 * - Memoized filtered and paginated results
 * 
 * @param {Object} options - Hook options
 * @param {Array} options.songs - Array of song objects to display
 * @param {number} options.pageSize - Items per page (default: 25)
 * @param {Object} options.initialState - Initial state for search/page (for persistence)
 * @param {Function} options.onStateChange - Callback when state changes (for persistence)
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useDebounce } from '../../hooks';

const DEFAULT_PAGE_SIZE = 25;

export function useSongTableState({
  songs = [],
  pageSize = DEFAULT_PAGE_SIZE,
  initialState = {},
  onStateChange = null,
}) {
  // Initialize state from initialState prop (for cache persistence)
  const [searchQuery, setSearchQuery] = useState(initialState.searchQuery || '');
  const [currentPage, setCurrentPage] = useState(initialState.currentPage || 1);
  const [itemsPerPage, setItemsPerPage] = useState(initialState.itemsPerPage || pageSize);

  // Debounce search query for performance
  const debouncedSearchQuery = useDebounce(searchQuery, 150);

  // Track if this is the initial mount to avoid triggering onStateChange
  const isInitialMount = useRef(true);

  // Notify parent of state changes for persistence
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (onStateChange) {
      onStateChange({
        searchQuery,
        currentPage,
        itemsPerPage,
      });
    }
  }, [searchQuery, currentPage, itemsPerPage, onStateChange]);

  // Filter songs based on debounced search query
  const filteredSongs = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return songs;
    }

    const query = debouncedSearchQuery.toLowerCase().trim();
    
    return songs.filter(song => {
      const title = (song.title || '').toLowerCase();
      const artist = (song.artistName || '').toLowerCase();
      const album = (song.albumName || '').toLowerCase();
      
      return title.includes(query) || 
             artist.includes(query) || 
             album.includes(query);
    });
  }, [songs, debouncedSearchQuery]);

  // Calculate pagination values
  const totalItems = filteredSongs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  
  // Clamp current page to valid range when filtered results change
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  // Update current page if it becomes invalid
  useEffect(() => {
    if (currentPage !== validCurrentPage) {
      setCurrentPage(validCurrentPage);
    }
  }, [currentPage, validCurrentPage]);

  // Get paginated songs for current page
  const paginatedSongs = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredSongs.slice(startIndex, endIndex);
  }, [filteredSongs, validCurrentPage, itemsPerPage]);

  // Navigation handlers
  const goToPage = useCallback((page) => {
    const newPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(newPage);
  }, [totalPages]);

  const goToNextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [goToPage, currentPage]);

  const goToPreviousPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [goToPage, currentPage]);

  const goToFirstPage = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  const goToLastPage = useCallback(() => {
    goToPage(totalPages);
  }, [goToPage, totalPages]);

  // Update search query
  const updateSearchQuery = useCallback((query) => {
    setSearchQuery(query);
  }, []);

  // Update items per page
  const updateItemsPerPage = useCallback((count) => {
    setItemsPerPage(count);
    setCurrentPage(1); // Reset to first page when changing page size
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return {
    // State
    searchQuery,
    debouncedSearchQuery,
    currentPage: validCurrentPage,
    itemsPerPage,
    
    // Computed
    filteredSongs,
    paginatedSongs,
    totalItems,
    totalPages,
    
    // Pagination info
    hasNextPage: validCurrentPage < totalPages,
    hasPreviousPage: validCurrentPage > 1,
    startIndex: totalItems === 0 ? 0 : (validCurrentPage - 1) * itemsPerPage + 1,
    endIndex: Math.min(validCurrentPage * itemsPerPage, totalItems),
    
    // Actions
    updateSearchQuery,
    updateItemsPerPage,
    clearSearch,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
  };
}

export default useSongTableState;
