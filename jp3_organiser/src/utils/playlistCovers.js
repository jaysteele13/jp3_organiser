/**
 * Picks the album covers that make up a playlist's picture.
 */

const GRID_TILES = 4;
const SPLIT_TILES = 2;

/**
 * The different albums in a playlist, in playlist order, cut down to a tile count:
 * four or more albums give 4 (a 2x2 grid), two or three give 2 (two halves),
 * one gives 1 (the full square) and none gives an empty list.
 *
 * @param {Array<{artistName: string, albumName: string}>} songs - The playlist's songs, in order
 * @returns {Array<{artist: string, album: string}>} 0, 1, 2 or 4 albums
 */
export function collageAlbums(songs) {
  const albums = new Map();
  for (const { artistName, albumName } of songs) {
    if (!artistName || !albumName) continue;
    const key = `${artistName}|||${albumName}`.toLowerCase();
    if (!albums.has(key)) albums.set(key, { artist: artistName, album: albumName });
  }

  const found = [...albums.values()];
  if (found.length >= GRID_TILES) return found.slice(0, GRID_TILES);
  return found.slice(0, SPLIT_TILES);
}
