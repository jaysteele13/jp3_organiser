import { describe, expect, it } from 'vitest';
import { addToHistory } from './commandHistory';

describe('addToHistory', () => {
  it('puts the newest search first', () => {
    expect(addToHistory(['library a'], 'player b')).toEqual(['player b', 'library a']);
  });

  it('moves a repeated search to the front instead of duplicating it', () => {
    expect(addToHistory(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
  });

  it('keeps only the most recent entries', () => {
    expect(addToHistory(['a', 'b'], 'c', 2)).toEqual(['c', 'a']);
  });
});
