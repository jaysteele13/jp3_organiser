/**
 * useSongTableState Hook
 * 
 * Manages pagination state for SongTable component.
 * 
 * Features:
 * - Pagination with configurable page size
 * - Memoized paginated results
 * 
 * Note: Search is handled externally via LibrarySearch component.
 * 
 * @param {Object} options - Hook options
 * @param {Array} options.songs - Array of song objects to display
 * @param {number} options.pageSize - Items per page (default: 25)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';

const DEFAULT_PAGE_SIZE = 25;

export function useSongTableState({
  songs = [],
  pageSize = DEFAULT_PAGE_SIZE,
  initialPage = 1,
  onPageChange,
}) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [itemsPerPage, setItemsPerPage] = useState(pageSize);

  // Update itemsPerPage when pageSize prop changes
  useEffect(() => {
    setItemsPerPage(pageSize);
  }, [pageSize]);

  // Update currentPage when initialPage prop changes
  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  // Calculate pagination values
  const totalItems = songs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  
  // Clamp current page to valid range when songs change
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

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
    return songs.slice(startIndex, endIndex);
  }, [songs, validCurrentPage, itemsPerPage]);

  // Navigation handlers
  const goToPage = useCallback((page) => {
    const newPage = Math.min(Math.max(1, page), totalPages);
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  }, [totalPages, onPageChange]);

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

  // Update items per page
  const updateItemsPerPage = useCallback((count) => {
    setItemsPerPage(count);
    const newTotalPages = Math.max(1, Math.ceil(totalItems / count));
    const newPage = Math.min(currentPage, newTotalPages);
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  }, [totalItems, currentPage, onPageChange]);

  return {
    // State
    currentPage: validCurrentPage,
    itemsPerPage,
    
    // Computed
    paginatedSongs,
    totalItems,
    totalPages,
    
    // Pagination info
    hasNextPage: validCurrentPage < totalPages,
    hasPreviousPage: validCurrentPage > 1,
    startIndex: totalItems === 0 ? 0 : (validCurrentPage - 1) * itemsPerPage + 1,
    endIndex: Math.min(validCurrentPage * itemsPerPage, totalItems),
    
    // Actions
    updateItemsPerPage,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
  };
}

export default useSongTableState;
