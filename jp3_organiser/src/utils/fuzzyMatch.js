/**
 * Fuzzy Match Utility
 * 
 * Provides prefix-based and fuzzy matching against library entries.
 * Used for suggesting artists, albums, and titles based on user input.
 * 
 * Design decisions:
 * - Prefix matching is prioritized (faster, more intuitive for autocomplete)
 * - Case-insensitive matching
 * - Results sorted by match quality and alphabetically
 */

/**
 * Checks if a string starts with a prefix (case-insensitive)
 * @param {string} text - The text to check
 * @param {string} prefix - The prefix to match
 * @returns {boolean}
 */
function startsWithIgnoreCase(text, prefix) {
  if (!text || !prefix) return false;
  return text.toLowerCase().startsWith(prefix.toLowerCase());
}

/**
 * Checks if a string contains a substring (case-insensitive)
 * @param {string} text - The text to check
 * @param {string} substring - The substring to find
 * @returns {boolean}
 */
function containsIgnoreCase(text, substring) {
  if (!text || !substring) return false;
  return text.toLowerCase().includes(substring.toLowerCase());
}

/**
 * Calculates a simple match score for ranking results
 * Higher score = better match
 * @param {string} text - The text being matched
 * @param {string} query - The search query
 * @returns {number} Score (higher is better)
 */
function calculateMatchScore(text, query) {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Exact match gets highest score
  if (lowerText === lowerQuery) return 100;
  
  // Starts with query gets high score
  if (lowerText.startsWith(lowerQuery)) {
    // Shorter strings that match get higher scores (more specific)
    return 80 - Math.min(text.length - query.length, 30);
  }
  
  // Word boundary match (query matches start of a word)
  const words = lowerText.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    if (words[i].startsWith(lowerQuery)) {
      return 60 - i * 5; // Earlier word matches score higher
    }
  }
  
  // Contains match gets lower score
  if (lowerText.includes(lowerQuery)) {
    return 40;
  }
  
  return 0;
}

/**
 * Find matching entries from a list based on user input
 * @param {string} query - The user's input
 * @param {string[]} entries - Array of strings to match against
 * @param {Object} options - Matching options
 * @param {number} options.limit - Maximum results to return (default: 5)
 * @param {number} options.minQueryLength - Minimum query length to trigger matching (default: 1)
 * @returns {string[]} Sorted array of matching entries
 */
export function findMatches(query, entries, options = {}) {
  const { limit = 5, minQueryLength = 1 } = options;
  
  // Validate inputs
  if (!query || query.length < minQueryLength || !Array.isArray(entries)) {
    return [];
  }
  
  const trimmedQuery = query.trim();
  if (trimmedQuery.length < minQueryLength) {
    return [];
  }
  
  // Score and filter entries
  const scored = entries
    .map(entry => ({
      entry,
      score: calculateMatchScore(entry, trimmedQuery),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => {
      // Sort by score descending, then alphabetically
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.entry.localeCompare(b.entry);
    });
  
  // Return top matches
  return scored.slice(0, limit).map(item => item.entry);
}

/**
 * Find the best single match for autocomplete
 * @param {string} query - The user's input
 * @param {string[]} entries - Array of strings to match against
 * @returns {string|null} Best matching entry or null
 */
export function findBestMatch(query, entries) {
  const matches = findMatches(query, entries, { limit: 1 });
  return matches.length > 0 ? matches[0] : null;
}

/**
 * Extract unique values from library data
 * @param {Object} library - Parsed library object
 * @returns {Object} Object with artists, albums, titles arrays
 */
export function extractLibraryEntries(library) {
  if (!library) {
    return { artists: [], albums: [], titles: [] };
  }
  
  const artists = library.artists?.map(a => a.name) || [];
  const albums = library.albums?.map(a => a.name) || [];
  const titles = library.songs?.map(s => s.title) || [];
  
  // Return unique, sorted values
  return {
    artists: [...new Set(artists)].sort(),
    albums: [...new Set(albums)].sort(),
    titles: [...new Set(titles)].sort(),
  };
}

/**
 * Extract albums with full metadata (artist, year) for smart autofill
 * @param {Object} library - Parsed library object
 * @returns {Object[]} Array of album objects with { name, artistName, artistId, year }
 */
export function extractAlbumsWithMetadata(library) {
  if (!library || !library.albums) {
    return [];
  }
  
  return library.albums.map(album => ({
    name: album.name,
    artistName: album.artistName || '',
    artistId: album.artistId,
    year: album.year || null,
  }));
}

/**
 * Find albums matching a query, returning full album objects
 * @param {string} query - The user's input
 * @param {Object[]} albums - Array of album objects from extractAlbumsWithMetadata
 * @param {Object} options - Matching options
 * @param {number} options.limit - Maximum results to return (default: 5)
 * @returns {Object[]} Sorted array of matching album objects
 */
export function findAlbumMatches(query, albums, options = {}) {
  const { limit = 5 } = options;
  
  if (!query || query.trim().length === 0 || !Array.isArray(albums)) {
    return [];
  }
  
  const trimmedQuery = query.trim();
  
  // Score and filter albums by name
  const scored = albums
    .map(album => ({
      album,
      score: calculateMatchScore(album.name, trimmedQuery),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.album.name.localeCompare(b.album.name);
    });
  
  return scored.slice(0, limit).map(item => item.album);
}
