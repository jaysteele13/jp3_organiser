/**
 * SongTable Component
 * 
 * Reusable song list component with search and pagination.
 * Supports two display variants: 'table' (traditional rows) and 'card' (Spotify-style).
**/

import React, { useCallback } from 'react';
import { useSongTableState } from './useSongTableState';
import SongTableRow from './SongTableRow';
import SongTableCard from './SongTableCard';
import styles from './SongTable.module.css';

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_COLUMNS = ['title', 'artist', 'album', 'duration'];

// Column header labels
const COLUMN_LABELS = {
  title: 'Title',
  artist: 'Artist',
  album: 'Album',
  duration: 'Duration',
  path: 'Path',
};

export default function SongTable({
  songs = [],
  variant = 'table',
  pageSize = DEFAULT_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  searchable = true,
  searchPlaceholder = 'Search by title, artist, or album...',
  emptyMessage = 'No songs available',
  noResultsMessage = 'No songs match your search',
  columns = DEFAULT_COLUMNS,
  renderActions,
  onRowClick,
  onTitleClick,
  onArtistClick,
  onAlbumClick,
  highlightId,
  initialState,
  onStateChange,
  showTrackNumber = false,
  cardSubtitle,
  renderCard,
}) {
  const state = useSongTableState({
    songs,
    pageSize,
    initialState,
    onStateChange,
  });

  const {
    searchQuery,
    paginatedSongs,
    totalItems,
    totalPages,
    currentPage,
    itemsPerPage,
    hasNextPage,
    hasPreviousPage,
    startIndex,
    endIndex,
    updateSearchQuery,
    updateItemsPerPage,
    clearSearch,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
  } = state;

  const handleSearchChange = useCallback((e) => {
    updateSearchQuery(e.target.value);
  }, [updateSearchQuery]);

  const handlePageSizeChange = useCallback((e) => {
    updateItemsPerPage(Number(e.target.value));
  }, [updateItemsPerPage]);

  const handleClearSearch = useCallback(() => {
    clearSearch();
  }, [clearSearch]);

  // Calculate the actual display index for each song (accounting for pagination)
  const getDisplayIndex = useCallback((index) => {
    return startIndex - 1 + index;
  }, [startIndex]);

  // Check if songs array is empty (before any filtering)
  const isEmpty = songs.length === 0;
  
  // Check if filtered results are empty (after search)
  const isNoResults = !isEmpty && paginatedSongs.length === 0 && searchQuery.trim().length > 0;

  return (
    <div className={styles.container}>
      {/* Search and Controls Bar */}
      {searchable && (
        <div className={styles.controlsBar}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Search songs"
            />
            {searchQuery && (
              <button
                className={styles.clearBtn}
                onClick={handleClearSearch}
                aria-label="Clear search"
                type="button"
              >
                ×
              </button>
            )}
          </div>
          
          <div className={styles.controlsRight}>
            <span className={styles.resultsCount}>
              {totalItems} {totalItems === 1 ? 'song' : 'songs'}
            </span>
          </div>
        </div>
      )}

      {/* Content Area */}
      {isEmpty ? (
        <div className={styles.emptyState}>{emptyMessage}</div>
      ) : isNoResults ? (
        <div className={styles.emptyState}>{noResultsMessage}</div>
      ) : variant === 'table' ? (
        /* Table Variant */
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thIndex}>#</th>
                {columns.includes('title') && <th className={styles.thTitle}>{COLUMN_LABELS.title}</th>}
                {columns.includes('artist') && <th className={styles.thArtist}>{COLUMN_LABELS.artist}</th>}
                {columns.includes('album') && <th className={styles.thAlbum}>{COLUMN_LABELS.album}</th>}
                {columns.includes('duration') && (
                  <th className={styles.thDuration}>{COLUMN_LABELS.duration}</th>
                )}
                {columns.includes('path') && <th className={styles.thPath}>{COLUMN_LABELS.path}</th>}
                {renderActions && <th className={styles.thActions}></th>}
              </tr>
            </thead>
            <tbody>
              {paginatedSongs.map((song, index) => (
                <SongTableRow
                  key={song.id}
                  song={song}
                  index={getDisplayIndex(index)}
                  isHighlighted={highlightId === song.id}
                  columns={columns}
                  onRowClick={onRowClick}
                  onTitleClick={onTitleClick}
                  onArtistClick={onArtistClick}
                  onAlbumClick={onAlbumClick}
                  renderActions={renderActions}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Card Variant */
        <div className={styles.cardList}>
          {paginatedSongs.map((song) => (
            renderCard ? (
              // Custom card component provided
              <React.Fragment key={song.id}>
                {renderCard(song, {
                  isHighlighted: highlightId === song.id,
                  onRowClick,
                  showTrackNumber,
                })}
              </React.Fragment>
            ) : (
              // Default SongTableCard
              <SongTableCard
                key={song.id}
                song={song}
                isHighlighted={highlightId === song.id}
                onRowClick={onRowClick}
                onArtistClick={onArtistClick}
                onAlbumClick={onAlbumClick}
                renderActions={renderActions}
                showTrackNumber={showTrackNumber}
                subtitle={cardSubtitle}
              />
            )
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <div className={styles.paginationLeft}>
            <label className={styles.pageSizeLabel}>
              Show:
              <select
                className={styles.pageSizeSelect}
                value={itemsPerPage}
                onChange={handlePageSizeChange}
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.paginationCenter}>
            <button
              className={styles.pageBtn}
              onClick={goToFirstPage}
              disabled={!hasPreviousPage}
              aria-label="First page"
              type="button"
            >
              ««
            </button>
            <button
              className={styles.pageBtn}
              onClick={goToPreviousPage}
              disabled={!hasPreviousPage}
              aria-label="Previous page"
              type="button"
            >
              «
            </button>
            
            <span className={styles.pageInfo}>
              {startIndex}–{endIndex} of {totalItems}
            </span>
            
            <button
              className={styles.pageBtn}
              onClick={goToNextPage}
              disabled={!hasNextPage}
              aria-label="Next page"
              type="button"
            >
              »
            </button>
            <button
              className={styles.pageBtn}
              onClick={goToLastPage}
              disabled={!hasNextPage}
              aria-label="Last page"
              type="button"
            >
              »»
            </button>
          </div>

          <div className={styles.paginationRight}>
            <span className={styles.pageNumber}>
              Page {currentPage} of {totalPages}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
