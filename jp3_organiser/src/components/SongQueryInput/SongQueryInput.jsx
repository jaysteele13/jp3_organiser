/**
 * SongQueryInput
 *
 * Search box that understands the "/" command bar's filters: plain words, key=value
 * (title=, artist=, album=, year=), quotes for names with spaces, and "and" for more values.
 * Tab completes a key ("ar" -> "artist=") or picks a name from the list; Up / Down move
 * through the list; Enter picks the highlighted name.
 *
 * @param {Object} props
 * @param {Array} props.songs - Songs the name suggestions come from
 * @param {string} props.value - The query text
 * @param {function} props.onChange - Called with the new query text
 * @param {string} props.placeholder
 * @param {string} props.className - Styles the box around the input
 */

import { useState } from 'react';
import { lastTerm, pickValue, suggestKey, suggestValues } from '../../utils/commandParser';
import bar from '../CommandBar/CommandBar.module.css';
import styles from './SongQueryInput.module.css';

const KEYS = ['title', 'artist', 'album', 'year'];

export default function SongQueryInput({ songs, value, onChange, placeholder, className = '' }) {
  const [highlight, setHighlight] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const term = lastTerm(value);
  const key = suggestKey(term, KEYS);
  const completion = key ? `${key.slice(term.length)}=` : '';
  const values = isFocused ? suggestValues(songs, value) : [];

  const update = (next) => {
    onChange(next);
    setHighlight(0);
  };
  const pick = (name) => update(pickValue(value, name));

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') e.target.blur();
    if (e.key === 'Tab' && !e.shiftKey && (values.length || completion)) {
      e.preventDefault(); // Otherwise Tab leaves the box
      values.length ? pick(values[highlight]) : update(value + completion);
    }
    if (!values.length) return;
    if (e.key === 'Enter') pick(values[highlight]);
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setHighlight((highlight + step + values.length) % values.length);
    }
  };

  return (
    <div className={`${styles.box} ${className}`}>
      <div className={bar.field}>
        {/* Greyed suggestion sits behind the input, lined up with the typed text */}
        {completion && (
          <span className={bar.suggestion} aria-hidden="true">
            <span className={bar.typed}>{value}</span>
            {completion}
          </span>
        )}
        <input
          type="text"
          className={bar.input}
          value={value}
          placeholder={placeholder}
          onChange={(e) => update(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          aria-label="Search songs"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {values.length > 0 && (
        <ul className={`${bar.values} ${styles.list}`} role="listbox">
          {values.map((name, index) => (
            <li
              key={name}
              role="option"
              aria-selected={index === highlight}
              className={index === highlight ? bar.highlighted : undefined}
              // preventDefault keeps focus in the input, so the list stays open on click
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
