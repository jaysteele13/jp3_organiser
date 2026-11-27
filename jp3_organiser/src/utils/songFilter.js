// Keys you can type as key=value, mapped to the song field each one searches
export const FILTER_KEYS = {
  title: 'title',
  artist: 'artistName',
  album: 'albumName',
  year: 'year',
  playlist: 'playlistNames',
};

// A plain word checks every field except playlists, so a playlist's name does not pull in its songs
const TEXT_FIELDS = Object.values(FILTER_KEYS).filter((field) => field !== FILTER_KEYS.playlist);

/**
 * Tag each song with the names of the playlists it is in, so "playlist=" can filter on it.
 * @returns {Array} new song objects with a playlistNames array
 */
export function withPlaylistNames(songs, playlists) {
  return songs.map((song) => ({
    ...song,
    playlistNames: playlists.filter((playlist) => playlist.songIds?.includes(song.id)).map((playlist) => playlist.name),
  }));
}

const contains = (value, text) => String(value ?? '').toLowerCase().includes(text);

// A term is a run without spaces; a quoted part may contain spaces: artist="olivia rodrigo"
const TERM = /(?:[^\s"]+|"[^"]*"?)+/g;

export const splitTerms = (text) => text.match(TERM) ?? [];

/**
 * Turn query text into groups of wanted values.
 * 'olivia artist=queen and acdc' ->
 *   [{ field: null, values: ['olivia'] }, { field: 'artistName', values: ['queen', 'acdc'] }]
 * field null means "any field". "and" after a key=value adds another value to that key;
 * a value still being typed after "and" is ''.
 */
export function parseQuery(text) {
  const groups = [];
  let joining = false;

  for (const term of splitTerms(text.toLowerCase())) {
    const last = groups.at(-1);
    const clean = term.replaceAll('"', '');
    const equals = clean.indexOf('=');
    const wasJoining = joining;
    joining = false;

    if (Object.hasOwn(FILTER_KEYS, clean.slice(0, equals))) {
      groups.push({ field: FILTER_KEYS[clean.slice(0, equals)], values: [clean.slice(equals + 1)] });
    } else if (wasJoining) {
      last.values[last.values.length - 1] = clean;
    } else if (term === 'and' && last?.field) {
      last.values.push('');
      joining = true;
    } else {
      groups.push({ field: null, values: [clean] });
    }
  }
  return groups;
}

// A group matches when any of its values is found; an empty group (e.g. "artist=") matches everything
function matchesGroup(song, { field, values }) {
  const fields = field ? [field] : TEXT_FIELDS;
  const wanted = values.filter(Boolean);
  return !wanted.length || wanted.some((value) => fields.some((name) => contains(song[name], value)));
}

/** True when the song matches every group from parseQuery. */
export const matchesQuery = (song, groups) => groups.every((group) => matchesGroup(song, group));

/**
 * Keep songs that match the query text (case-insensitive).
 * @param {Array} songs
 * @param {string} text - e.g. 'olivia year=2021' or 'artist="olivia rodrigo" and queen'
 * @returns {Array} the same array when text is empty
 */
export function filterSongsByText(songs, text) {
  const groups = parseQuery(text);
  if (!groups.length) return songs;
  return songs.filter((song) => matchesQuery(song, groups));
}

/**
 * Keep the artists or albums that have at least one song matching the query.
 * @param {Array} items - artists or albums
 * @param {Array} songs
 * @param {string} text - query text
 * @param {string} idField - the song field that points at the item: 'artistId' or 'albumId'
 * @returns {Array} the same array when text is empty
 */
export function filterByQuery(items, songs, text, idField) {
  if (!text.trim()) return items;
  const ids = new Set(filterSongsByText(songs, text).map((song) => song[idField]));
  return items.filter((item) => ids.has(item.id));
}

/**
 * Keep the playlists that contain at least one song matching the query.
 * @returns {Array} the same array when text is empty
 */
export function filterPlaylistsByQuery(playlists, songs, text) {
  if (!text.trim()) return playlists;
  const ids = new Set(filterSongsByText(songs, text).map((song) => song.id));
  return playlists.filter((playlist) => playlist.songIds?.some((id) => ids.has(id)));
}
