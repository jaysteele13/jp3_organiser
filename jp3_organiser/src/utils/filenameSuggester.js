/**
 * Filename Suggester Utility
 * 
 * Transforms raw filenames into human-readable metadata suggestions.
 * Uses heuristic string manipulation to convert patterns like
 * "dont_stop_me_now" into "Don't Stop Me Now".
 * 
 * Designed for extensibility - can be enhanced with library matching
 * in the future (Approach 3).
 */

// Common contractions map: expanded form -> contracted form
const CONTRACTIONS = {
  'dont': "don't",
  'cant': "can't",
  'wont': "won't",
  'isnt': "isn't",
  'arent': "aren't",
  'wasnt': "wasn't",
  'werent': "weren't",
  'hasnt': "hasn't",
  'havent': "haven't",
  'hadnt': "hadn't",
  'doesnt': "doesn't",
  'didnt': "didn't",
  'couldnt': "couldn't",
  'shouldnt': "shouldn't",
  'wouldnt': "wouldn't",
  'aint': "ain't",
  'lets': "let's",
  'its': "it's",
  'thats': "that's",
  'whats': "what's",
  'heres': "here's",
  'theres': "there's",
  'wheres': "where's",
  'whos': "who's",
  'youre': "you're",
  'theyre': "they're",
  'were': "we're",
  'ive': "i've",
  'youve': "you've",
  'weve': "we've",
  'theyve': "they've",
  'ill': "i'll",
  'youll': "you'll",
  'well': "we'll",
  'theyll': "they'll",
  'id': "i'd",
  'youd': "you'd",
  'hed': "he'd",
  'shed': "she'd",
  'wed': "we'd",
  'theyd': "they'd",
  'im': "i'm",
};

// Words that should remain lowercase (unless first word)
const LOWERCASE_WORDS = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'at', 'by', 'in', 'of', 'on', 'to', 'up', 'as', 'vs', 'via', 'are', 'our'
]);

// Words/acronyms that should remain uppercase
const UPPERCASE_WORDS = new Set([
  'dj', 'mc', 'tv', 'uk', 'usa', 'la', 'nyc', 'ac', 'dc'
]);

/**
 * Removes file extension from filename
 * @param {string} filename - The filename with or without extension
 * @returns {string} Filename without extension
 */
function removeExtension(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return filename;
  }
  
  const extension = filename.slice(lastDotIndex + 1).toLowerCase();
  const audioExtensions = ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus', 'aac', 'wma'];
  
  if (audioExtensions.includes(extension)) {
    return filename.slice(0, lastDotIndex);
  }
  
  return filename;
}

/**
 * Splits a string on common separators including camelCase
 * @param {string} str - The string to split
 * @returns {string[]} Array of words
 */
function splitOnSeparators(str) {
  // Replace common separators with spaces
  let normalized = str
    .replace(/[_\-\.]/g, ' ')  // underscores, hyphens, dots
    .replace(/\s+/g, ' ')       // collapse multiple spaces
    .trim();
  
  // Handle camelCase and PascalCase
  normalized = normalized.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Handle sequences like "ABC123" -> "ABC 123"
  normalized = normalized.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  normalized = normalized.replace(/(\d)([a-zA-Z])/g, '$1 $2');
  
  return normalized.split(' ').filter(word => word.length > 0);
}

/**
 * Applies title case to a word, respecting special cases
 * @param {string} word - The word to title case
 * @param {boolean} isFirst - Whether this is the first word
 * @returns {string} Title-cased word
 */
function titleCaseWord(word, isFirst) {
  const lower = word.toLowerCase();
  
  // Check for contractions
  if (CONTRACTIONS[lower]) {
    const contracted = CONTRACTIONS[lower];
    // Capitalize first letter if it's the first word
    if (isFirst) {
      return contracted.charAt(0).toUpperCase() + contracted.slice(1);
    }
    return contracted;
  }
  
  // Check for uppercase acronyms
  if (UPPERCASE_WORDS.has(lower)) {
    return word.toUpperCase();
  }
  
  // Check for lowercase words (unless first word)
  if (!isFirst && LOWERCASE_WORDS.has(lower)) {
    return lower;
  }
  
  // Default: capitalize first letter
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Transforms a filename into a suggested title
 * @param {string} filename - The raw filename
 * @returns {string} Human-readable suggestion
 */
export function suggestFromFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  
  // Step 1: Remove file extension
  const withoutExtension = removeExtension(filename);
  
  // Step 2: Split on separators
  const words = splitOnSeparators(withoutExtension);
  
  if (words.length === 0) {
    return '';
  }
  
  // Step 3: Apply title case with special handling
  const titleCased = words.map((word, index) => 
    titleCaseWord(word, index === 0)
  );
  
  return titleCased.join(' ');
}

/**
 * Checks if a suggestion differs meaningfully from the original
 * @param {string} original - Original filename
 * @param {string} suggestion - Generated suggestion
 * @returns {boolean} True if suggestion adds value
 */
export function isSuggestionUseful(original, suggestion) {
  if (!original || !suggestion) {
    return false;
  }
  
  // Normalize for comparison
  const normalizedOriginal = removeExtension(original).toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedSuggestion = suggestion.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Suggestion is useful if it's not empty and transforms the text
  return normalizedSuggestion.length > 0 && 
         normalizedOriginal !== normalizedSuggestion.replace(/'/g, '');
}
