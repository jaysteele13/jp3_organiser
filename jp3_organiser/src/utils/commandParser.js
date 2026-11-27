import { FILTER_KEYS, matchesQuery, parseQuery, splitTerms } from './songFilter';
import { TABS } from './enums';

export const COMMANDS = {
  library: '/view',
  player: '/player',
};

// What "| show=" accepts, mapped to the tab it opens
const SHOW_TABS = {
  song: TABS.SONGS,
  album: TABS.ALBUMS,
  artist: TABS.ARTISTS,
  playlist: TABS.PLAYLISTS,
};

/**
 * Split command bar input into a route, search text and the tab to open.
 * Text after "|" holds extra instructions; "show=artist" picks the tab (default: songs).
 * @param {string} input - Text typed after "/", e.g. "library artist=queen | show=album"
 * @returns {{ route: string, text: string, tab: string } | null} null if the command is unknown
 */
export function parseCommand(input) {
  const [query, ...pipes] = input.split('|');
  const [command, ...rest] = query.trim().split(/\s+/);
  const name = command.toLowerCase();
  // hasOwn stops inherited names like "constructor" passing as commands
  if (!Object.hasOwn(COMMANDS, name)) return null;

  // "artists" and "artist" both work
  const show = pipes.join(' ').toLowerCase().match(/show=(\w+?)s?\b/)?.[1] ?? '';
  return {
    route: COMMANDS[name],
    text: rest.join(' '),
    tab: Object.hasOwn(SHOW_TABS, show) ? SHOW_TABS[show] : TABS.SONGS,
  };
}

/**
 * Rebuild the command text for a page, the reverse of parseCommand.
 * @param {string} route - e.g. "/view"
 * @param {string} text - the query
 * @param {string} tab - the tab being shown
 * @returns {string} e.g. "library artist=queen\n| show=album" ('' if the route has no command)
 */
export function formatCommand(route, text, tab) {
  const name = Object.keys(COMMANDS).find((key) => COMMANDS[key] === route);
  if (!name) return '';
  const show = Object.keys(SHOW_TABS).find((key) => SHOW_TABS[key] === tab);
  return `${name} ${text}${show && tab !== TABS.SONGS ? `\n| show=${show}` : ''}`;
}

// Window event that opens the command bar pre-filled; detail is the command text
export const EDIT_COMMAND_EVENT = 'edit-command';

/**
 * Suggest what to show for a term like "show=a" (nothing once it is complete).
 * @returns {string[]}
 */
export function suggestShow(term) {
  const [key, value] = term.toLowerCase().split('=');
  if (key !== 'show' || value === undefined) return [];
  return Object.keys(SHOW_TABS).filter((name) => name.startsWith(value) && name !== value);
}

/**
 * Swap the command word for the next one (library <-> player), keeping the query after it.
 * An empty or unknown command becomes the first one.
 * @param {string} input - e.g. "library artist=queen" -> "player artist=queen"
 */
export function switchCommand(input) {
  const names = Object.keys(COMMANDS);
  const [command, ...rest] = input.split(' ');
  const next = names[(names.indexOf(command.toLowerCase()) + 1) % names.length];
  return `${next} ${rest.join(' ')}`;
}

/**
 * Suggest the name that the typed letters start, for Tab autocomplete.
 * @returns {string | null}
 */
function suggestFrom(names, input) {
  const typed = input.toLowerCase();
  if (!typed) return null;
  return names.find((name) => name.startsWith(typed)) ?? null;
}

/** Suggest a command, e.g. "l" -> "library". */
export const suggestCommand = (input) => suggestFrom(Object.keys(COMMANDS), input);

/** Suggest a filter key, e.g. "ar" -> "artist". */
export const suggestKey = (word) => suggestFrom(Object.keys(FILTER_KEYS), word);

/** Suggest a key for a line after "|", e.g. "sh" -> "show". */
export const suggestPipeKey = (word) => suggestFrom(['show'], word);

/**
 * The term still being typed at the end of the input ('' after a finished term).
 * @param {string} input - e.g. 'library artist="olivia ro'
 */
export function lastTerm(input) {
  const term = splitTerms(input).at(-1) ?? '';
  return input.endsWith(term) ? term : '';
}

/**
 * Suggest names for the key=value still being typed, e.g. the album in
 * "artist=queen album=". Only names from songs that fit the rest of the query
 * are offered; names that start with the typed text come first.
 * @param {Array} songs
 * @param {string} text - the query after the command
 * @returns {string[]} at most `max` names
 */
export function suggestValues(songs, text, max = 6) {
  const groups = parseQuery(text);
  const current = groups.pop();
  const typed = current?.values.at(-1);
  // Nothing to suggest for plain words, or once the value is finished (a space after it)
  if (!current?.field || (typed && !lastTerm(text))) return [];

  const chosen = current.values.slice(0, -1);
  const names = [...new Set(
    // flatMap also unpacks list fields (a song's playlist names) into separate entries
    songs.filter((song) => matchesQuery(song, groups)).flatMap((song) => song[current.field] || []).map(String)
  )].filter((name) => name && name.toLowerCase().includes(typed) && !chosen.includes(name.toLowerCase()));

  const startsWithTyped = (name) => name.toLowerCase().startsWith(typed);
  return names.sort((a, b) => startsWithTyped(b) - startsWithTyped(a)).slice(0, max);
}
