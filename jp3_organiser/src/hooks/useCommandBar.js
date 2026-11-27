import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDebounce } from './useDebounce';
import { useLibraryConfig } from './useLibraryConfig';
import { useCommandHistory } from './useCommandHistory';
import { getCachedLibrary } from './libraryCache';
import {
  lastTerm, parseCommand, suggestCommand, suggestKey, suggestPipeKey, suggestShow, suggestValues, switchCommand,
} from '../utils/commandParser';

/**
 * State and key handling for the open "/" command bar.
 * - Typing a command opens its page and filters the songs as you type
 * - Tab completes a command or filter key; after key= (or "and") it picks a name
 *   from the list, which only offers names that fit the rest of the query
 * - Shift+Tab swaps the command (library <-> player), keeping the query
 * - "|" starts a new line for extra instructions: "show=artist" or "show=album" picks the tab
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

  // What Tab offers depends on where you are: the command word, the query, or a line after "|"
  const term = lastTerm(input);
  const isCommand = !input.includes(' ');
  const query = input.slice(input.indexOf(' ') + 1);
  const inPipe = query.includes('|');
  const typed = isCommand ? input : term;
  const suggestWord = isCommand ? suggestCommand : inPipe ? suggestPipeKey : suggestKey;
  const match = suggestWord(typed);
  const completion = match ? match.slice(typed.length) + (isCommand ? ' ' : '=') : '';
  const songs = getCachedLibrary(libraryPath)?.songs ?? [];
  const values = isCommand ? [] : inPipe ? suggestShow(term) : suggestValues(songs, query);

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

  // Swap the value being typed for the chosen name, quoted if it has a space
  const pick = (name) => {
    const prefix = term.slice(0, term.indexOf('=') + 1); // "artist=", or '' for a value after "and"
    const value = name.replaceAll('"', '');
    update(`${input.slice(0, input.length - term.length)}${prefix}${value.includes(' ') ? `"${value}"` : value} `);
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
      values.length ? pick(values[highlight]) : run();
    }
    if (key === '|' && !isCommand) {
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
