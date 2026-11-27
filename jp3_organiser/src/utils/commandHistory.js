/**
 * Add a search to the command bar history: newest first, no duplicates.
 * @param {string[]} history
 * @param {string} entry
 * @param {number} max - how many entries to keep
 * @returns {string[]} a new array
 */
export function addToHistory(history, entry, max = 20) {
  return [entry, ...history.filter((item) => item !== entry)].slice(0, max);
}
