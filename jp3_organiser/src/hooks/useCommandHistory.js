import { useEffect, useState } from 'react';
import { load } from '@tauri-apps/plugin-store';
import { addToHistory } from '../utils/commandHistory';

const STORE_NAME = 'commandbar.json';
const HISTORY_KEY = 'history';

const openStore = () => load(STORE_NAME, { autoSave: true });

/**
 * Previous command bar searches, kept across restarts.
 * @returns {{ save: Function, step: Function }}
 *   save(entry) stores a search; step(1) returns the next older one, step(-1) the next newer
 *   ('' when you step past the newest, null when there is nowhere to go)
 */
export function useCommandHistory() {
  const [history, setHistory] = useState([]);
  const [index, setIndex] = useState(-1); // -1 = not browsing history

  useEffect(() => {
    openStore()
      .then((store) => store.get(HISTORY_KEY))
      .then((saved) => Array.isArray(saved) && setHistory(saved))
      .catch((error) => console.error('Failed to load command history:', error));
  }, []);

  const save = (entry) => {
    openStore()
      .then((store) => store.set(HISTORY_KEY, addToHistory(history, entry)))
      .catch((error) => console.error('Failed to save command history:', error));
  };

  const step = (direction) => {
    const next = Math.max(-1, Math.min(history.length - 1, index + direction));
    if (next === index) return null; // nothing older or newer
    setIndex(next);
    return history[next] ?? '';
  };

  return { save, step };
}
