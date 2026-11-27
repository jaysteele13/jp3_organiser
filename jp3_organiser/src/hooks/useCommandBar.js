import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDebounce } from './useDebounce';
import { useLibraryConfig } from './useLibraryConfig';
import { useCommandHistory } from './useCommandHistory';
import { getCachedLibrary } from './libraryCache';
import { listPlaylists } from '../services/libraryService';
import {
  lastTerm, matchPlaylists, parseCommand, pickValue, PLAYLIST_COMMAND, playlistQuery, suggestCommand, suggestKey,
  suggestPipeKey, suggestShow, suggestValues, switchCommand,
} from '../utils/commandParser';

/**
 * State and key handling for the open "/" command bar.
 * - Typing a command opens its page and filters the songs as you type
 * - Tab completes a command or filter key; after key= (or "and") it picks a name
 *   from the list, which only offers names that fit the rest of the query
 * - Shift+Tab swaps the command (library <-> player), keeping the query
 * - "|" starts a new line for extra instructions: "show=artist" or "show=album" picks the tab
 * - "playlist <name>" lists matching playlists; Enter opens the highlighted one's edit page
 * - Up / Down move through the name list, or through past searches when there is no list
 * - Enter saves the search and closes; Esc closes
 */
export function useCommandBar(onClose, initialInput = '') {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { libraryPath } = useLibraryConfig();
  const history = useCommandHistory();
  const [input, setInput] = useState(initialInput);
  const [error, setError] = useState('');
  const [highlight, setHighlight] = useState(0);

  // Playlist names for "playlist <name>", read fresh each time the bar opens
  const [playlists, setPlaylists] = useState([]);
  useEffect(() => {
    if (libraryPath) listPlaylists(libraryPath).then(setPlaylists).catch(() => {});
  }, [libraryPath]);
  const playlistName = playlistQuery(input);
  const isPlaylist = playlistName !== null;
  const playlistMatches = isPlaylist ? matchPlaylists(playlists, playlistName) : [];

  // What Tab offers depends on where you are: the command word, the query, or a line after "|"
  const term = lastTerm(input);
  const isCommand = !input.includes(' ');
  const query = input.slice(input.indexOf(' ') + 1);
  const inPipe = query.includes('|');
  const typed = isCommand ? input : term;
  const suggestWord = isCommand ? suggestCommand : inPipe ? suggestPipeKey : suggestKey;
  const match = suggestWord(typed);
  // A playlist's name is not a filter, so its letters are not completed to keys like "artist="
  const completion = match && !isPlaylist ? match.slice(typed.length) + (isCommand ? ' ' : '=') : '';
  const songs = getCachedLibrary(libraryPath)?.songs ?? [];
  const values = isPlaylist
    ? playlistMatches.map((playlist) => playlist.name)
    : isCommand ? [] : inPipe ? suggestShow(term) : suggestValues(songs, query);

  const update = (next) => {
    setInput(next);
    setError('');
    setHighlight(0);
  };

  // Open the command's page with its songs filtered. Returns false for an unknown command.
  const show = (text) => {
    const command = parseCommand(text);
    if (!command) return false;

    const params = new URLSearchParams({ tab: command.tab });
    if (command.text) params.set('q', command.text);
    // Replace while already on the page, so Back does not step through every keystroke
    navigate(`${command.route}?${params}`, { state: { tab: command.tab }, replace: pathname === command.route });
    return true;
  };

  // Live results: once the command word is finished, follow the typing after a short pause.
  // Nothing happens until the text differs from what the bar opened with, so opening it
  // pre-filled does not disturb the page's current filter or tab.
  const liveInput = useDebounce(input);
  useEffect(() => {
    if (liveInput !== initialInput && liveInput.includes(' ')) show(liveInput);
  }, [liveInput]);

  const pick = (name) => update(isPlaylist ? `${PLAYLIST_COMMAND} ${name}` : pickValue(input, name));

  const openPlaylist = () => {
    const playlist = playlistMatches[highlight];
    if (!playlist) return setError('Unknown playlist');
    navigate(`/playlist/${playlist.id}`);
    history.save(`${PLAYLIST_COMMAND} ${playlist.name}`);
    onClose();
  };

  const run = () => {
    if (!show(input)) return setError('Unknown command');
    history.save(input.trim());
    onClose();
  };

  const handleKeyDown = (e) => {
    const { key } = e;
    if (key === 'Escape') onClose();
    if (key === 'Enter') {
      e.preventDefault(); // Enter never adds a line; "|" does
      if (isPlaylist) openPlaylist();
      else values.length ? pick(values[highlight]) : run();
    }
    if (key === '|' && !isCommand && !isPlaylist) {
      e.preventDefault();
      update(`${input.trimEnd()}\n| `);
    }
    if (key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) update(switchCommand(input));
      else if (values.length) pick(values[highlight]);
      else if (completion) update(input + completion);
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      e.preventDefault();
      const direction = key === 'ArrowUp' ? 1 : -1;
      if (values.length) {
        setHighlight((highlight - direction + values.length) % values.length);
      } else {
        const entry = history.step(direction);
        if (entry !== null) update(entry);
      }
    }
  };

  const handleChange = (e) => update(e.target.value);

  return { input, error, completion, values, highlight, pick, handleChange, handleKeyDown };
}
