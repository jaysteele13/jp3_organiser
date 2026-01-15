/**
 * useLibrarySearch Hook
 * 
 * Performs debounced search across library entities (playlists, artists, albums, songs).
 * Returns categorized results in priority order.
 * 
 * @param {Object} library - Library data with songs, albums, artists, playlists arrays
 * @param {string} searchQuery - Current search query
 * @param {Object} options - Optional configuration
 * @param {number} options.debounceDelay - Debounce delay in ms (default: 200)
 * @param {number} options.maxResultsPerCategory - Max results per category (default: 5)
 * @returns {Object} Search results grouped by category
 */

import { useMemo } from 'react';
import { useDebounce } from './useDebounce';

// Search result category types
export const SEARCH_CATEGORY = {
  PLAYLIST: 'playlist',
  ARTIST: 'artist',
  ALBUM: 'album',
  SONG: 'song',
};

// Priority order for display
const CATEGORY_PRIORITY = [
  SEARCH_CATEGORY.PLAYLIST,
  SEARCH_CATEGORY.ARTIST,
  SEARCH_CATEGORY.ALBUM,
  SEARCH_CATEGORY.SONG,
];

/**
 * Simple case-insensitive search
 */
function matchesSearch(text, query) {
  if (!text || !query) return false;
  return text.toLowerCase().includes(query.toLowerCase().trim());
}

/**
 * Score a match based on how well it matches the query
 * Higher score = better match (starts with query > contains query)
 */
function getMatchScore(text, query) {
  if (!text || !query) return 0;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  
  if (lowerText === lowerQuery) return 100; // Exact match
  if (lowerText.startsWith(lowerQuery)) return 80; // Starts with
  if (lowerText.includes(lowerQuery)) return 50; // Contains
  return 0;
}

export function useLibrarySearch(library, searchQuery, options = {}) {
  const { debounceDelay = 200, maxResultsPerCategory = 5 } = options;
  
  // Debounce the search query
  const debouncedQuery = useDebounce(searchQuery, debounceDelay);
  
  // Compute search results
  const results = useMemo(() => {
    const query = debouncedQuery?.trim();
    
    // Return empty results if no query or library
    if (!query || !library) {
      return {
        playlists: [],
        artists: [],
        albums: [],
        songs: [],
        hasResults: false,
        totalCount: 0,
      };
    }
    
    // Search playlists
    const playlists = (library.playlists || [])
      .filter(p => matchesSearch(p.name, query))
      .map(p => ({
        ...p,
        score: getMatchScore(p.name, query),
        category: SEARCH_CATEGORY.PLAYLIST,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResultsPerCategory);
    
    // Search artists
    const artists = (library.artists || [])
      .filter(a => matchesSearch(a.name, query))
      .map(a => ({
        ...a,
        score: getMatchScore(a.name, query),
        category: SEARCH_CATEGORY.ARTIST,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResultsPerCategory);
    
    // Search albums
    const albums = (library.albums || [])
      .filter(a => matchesSearch(a.name, query) || matchesSearch(a.artistName, query))
      .map(a => ({
        ...a,
        score: Math.max(
          getMatchScore(a.name, query),
          getMatchScore(a.artistName, query) * 0.8 // Artist match weighted slightly less
        ),
        category: SEARCH_CATEGORY.ALBUM,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResultsPerCategory);
    
    // Search songs
    const songs = (library.songs || [])
      .filter(s => 
        matchesSearch(s.title, query) || 
        matchesSearch(s.artistName, query) || 
        matchesSearch(s.albumName, query)
      )
      .map(s => ({
        ...s,
        score: Math.max(
          getMatchScore(s.title, query),
          getMatchScore(s.artistName, query) * 0.7,
          getMatchScore(s.albumName, query) * 0.6
        ),
        category: SEARCH_CATEGORY.SONG,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResultsPerCategory);
    
    const totalCount = playlists.length + artists.length + albums.length + songs.length;
    
    return {
      playlists,
      artists,
      albums,
      songs,
      hasResults: totalCount > 0,
      totalCount,
    };
  }, [library, debouncedQuery, maxResultsPerCategory]);
  
  // Create a flat, ordered list of all results for keyboard navigation
  const flatResults = useMemo(() => {
    const allResults = [];
    
    // Add in priority order
    for (const category of CATEGORY_PRIORITY) {
      switch (category) {
        case SEARCH_CATEGORY.PLAYLIST:
          allResults.push(...results.playlists);
          break;
        case SEARCH_CATEGORY.ARTIST:
          allResults.push(...results.artists);
          break;
        case SEARCH_CATEGORY.ALBUM:
          allResults.push(...results.albums);
          break;
        case SEARCH_CATEGORY.SONG:
          allResults.push(...results.songs);
          break;
      }
    }
    
    return allResults;
  }, [results]);
  
  return {
    ...results,
    flatResults,
    isSearching: debouncedQuery !== searchQuery,
    query: debouncedQuery,
  };
}
