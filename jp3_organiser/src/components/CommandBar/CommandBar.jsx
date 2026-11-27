/**
 * CommandBar Component
 *
 * Keyboard command bar opened with "/". Type "library <text>" or "player <text>"
 * to open that page with its songs filtered as you type.
 * Text can include key=value filters: title=, artist=, album=, year=, playlist=.
 * "|" starts a new line; "| show=artist" or "| show=album" opens that tab instead of Songs.
 * "playlist <name>" opens that playlist's edit page.
 * See useCommandBar for the keys (Tab, arrows, Enter, Esc).
 */

import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { useCommandBar } from '../../hooks/useCommandBar';
import { EDIT_COMMAND_EVENT, formatCommand } from '../../utils/commandParser';
import { TABS } from '../../utils/enums';
import styles from './CommandBar.module.css';

export default function CommandBar() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const [initialInput, setInitialInput] = useState(null); // null = closed

  // "/" opens the bar holding the current page's command, with its active search if there is one:
  // "library pool" on the Library, "player " on the Player and its detail pages, empty elsewhere.
  // Clicking a filter's text opens it the same way.
  const page = `/${pathname.split('/')[1]}`;
  const query = searchParams.get('q') ?? '';
  // The tab ("| show=") is only carried over with a search, so a bare "library " leaves the cursor ready to type
  const tab = (query && searchParams.get('tab')) || TABS.SONGS;
  useKeyboardShortcut('/', () => setInitialInput(formatCommand(page, query, tab)), { ignoreInInputs: true });
  useEffect(() => {
    const openWithCommand = (e) => setInitialInput(e.detail);
    window.addEventListener(EDIT_COMMAND_EVENT, openWithCommand);
    return () => window.removeEventListener(EDIT_COMMAND_EVENT, openWithCommand);
  }, []);

  // The panel mounts fresh each time it opens
  if (initialInput === null) return null;
  return <CommandBarPanel initialInput={initialInput} onClose={() => setInitialInput(null)} />;
}

function CommandBarPanel({ initialInput, onClose }) {
  const { input, error, completion, values, highlight, pick, handleChange, handleKeyDown } = useCommandBar(onClose, initialInput);

  return (
    <div className={styles.bar}>
      <span>/</span>
      <div className={styles.field}>
        {/* Greyed suggestion sits behind the input, lined up with the typed text */}
        {completion && (
          <span className={styles.suggestion} aria-hidden="true">
            <span className={styles.typed}>{input}</span>
            {completion}
          </span>
        )}
        <textarea
          className={styles.input}
          rows={input.split('\n').length}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onClose}
          // Start with the cursor after any pre-filled command
          onFocus={(e) => e.target.setSelectionRange(input.length, input.length)}
          aria-label="Command bar"
          spellCheck={false}
          autoComplete="off"
          autoFocus
        />
      </div>
      {error && <span className={styles.error} role="alert">{error}</span>}

      {values.length > 0 && (
        <ul className={styles.values} role="listbox">
          {values.map((name, index) => (
            <li
              key={name}
              role="option"
              aria-selected={index === highlight}
              className={index === highlight ? styles.highlighted : undefined}
              // preventDefault keeps focus in the input, so the bar does not close on click
              onMouseDown={(e) => {
                e.preventDefault();
                pick(name);
              }}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
