import { describe, expect, it } from 'vitest';
import {
  formatCommand, lastTerm, parseCommand, pickValue, suggestCommand, suggestKey, suggestShow, suggestValues, switchCommand,
} from './commandParser';

const songs = [
  { title: 'drivers license', artistName: 'Olivia Rodrigo', albumName: 'SOUR', year: 2021 },
  { title: 'good 4 u', artistName: 'Olivia Rodrigo', albumName: 'SOUR', year: 2021 },
  { title: 'Yellow', artistName: 'Coldplay', albumName: 'Parachutes', year: 2000 },
  { title: 'Bohemian Rhapsody', artistName: 'Queen', albumName: 'A Night at the Opera', year: 1975 },
];

describe('commandParser', () => {
  it('parses a command and its search text', () => {
    expect(parseCommand('library drivers license')).toEqual({ route: '/view', text: 'drivers license', tab: 'songs' });
    expect(parseCommand('player')).toEqual({ route: '/player', text: '', tab: 'songs' });
  });

  it('reads "| show=" on a later line as the tab to open', () => {
    expect(parseCommand('library artist=queen and acdc\n| show=artist')).toEqual({
      route: '/view',
      text: 'artist=queen and acdc',
      tab: 'artists',
    });
    expect(parseCommand('player queen | show=Albums').tab).toBe('albums');
    expect(parseCommand('player queen | show=playlist').tab).toBe('playlists');
    expect(parseCommand('player queen | show=nonsense').tab).toBe('songs');
    expect(parseCommand('player queen | sh').tab).toBe('songs');
  });

  it('rebuilds the command text from a page, query and tab', () => {
    expect(formatCommand('/view', 'artist=queen', 'songs')).toBe('library artist=queen');
    expect(formatCommand('/player', 'artist=queen and acdc', 'albums')).toBe('player artist=queen and acdc\n| show=album');
    expect(formatCommand('/upload', 'x', 'songs')).toBe('');
    expect(formatCommand('/player', '', 'songs')).toBe('player ');
    const command = formatCommand('/view', 'queen', 'playlists');
    expect(parseCommand(command)).toEqual({ route: '/view', text: 'queen', tab: 'playlists' });
  });

  it('suggests what to show after "show="', () => {
    expect(suggestShow('show=')).toEqual(['song', 'album', 'artist', 'playlist']);
    expect(suggestShow('show=a')).toEqual(['album', 'artist']);
    expect(suggestShow('show=artist')).toEqual([]);
    expect(suggestShow('artist=a')).toEqual([]);
  });

  it('returns null for an unknown command', () => {
    expect(parseCommand('settings drivers')).toBeNull();
    expect(parseCommand('')).toBeNull();
    expect(parseCommand('constructor drivers')).toBeNull();
  });

  it('suggests a command from its first letters', () => {
    expect(suggestCommand('l')).toBe('library');
    expect(suggestCommand('pla')).toBe('player');
    expect(suggestCommand('x')).toBeNull();
  });

  it('switches to the other command, keeping the rest of the query', () => {
    expect(switchCommand('library artist=queen')).toBe('player artist=queen');
    expect(switchCommand('player artist=queen')).toBe('library artist=queen');
    expect(switchCommand('Library')).toBe('player ');
    expect(switchCommand('')).toBe('library ');
  });

  it('suggests a filter key from its first letters', () => {
    expect(suggestKey('ar')).toBe('artist');
    expect(suggestKey('y')).toBe('year');
    expect(suggestKey('')).toBeNull();
    expect(suggestKey('artist=')).toBeNull();
  });

  it('only suggests the keys it is given', () => {
    expect(suggestKey('p', ['title', 'artist'])).toBeNull();
    expect(suggestKey('t', ['title', 'artist'])).toBe('title');
  });

  it('swaps the value being typed for a picked name, quoted if it has a space', () => {
    expect(pickValue('artist=qu', 'Queen')).toBe('artist=Queen ');
    expect(pickValue('year=2021 artist=ol', 'Olivia Rodrigo')).toBe('year=2021 artist="Olivia Rodrigo" ');
    expect(pickValue('artist="olivia ro', 'Olivia Rodrigo')).toBe('artist="Olivia Rodrigo" ');
    expect(pickValue('artist=queen and co', 'Coldplay')).toBe('artist=queen and Coldplay ');
    expect(pickValue('artist=queen and ', 'Coldplay')).toBe('artist=queen and Coldplay ');
  });

  it('finds the term being typed, keeping an open quote together', () => {
    expect(lastTerm('library ar')).toBe('ar');
    expect(lastTerm('library artist="olivia ro')).toBe('artist="olivia ro');
    expect(lastTerm('library artist=olivia ')).toBe('');
  });

  it('suggests names for the value being typed', () => {
    expect(suggestValues(songs, 'artist=ol')).toEqual(['Olivia Rodrigo', 'Coldplay']);
    expect(suggestValues(songs, 'artist="olivia r')).toEqual(['Olivia Rodrigo']);
    expect(suggestValues(songs, 'title=y')).toEqual(['Yellow', 'Bohemian Rhapsody']);
    expect(suggestValues(songs, 'olivia')).toEqual([]);
    expect(suggestValues(songs, 'artist=queen ')).toEqual([]);
  });

  it('only suggests names that fit the rest of the query', () => {
    expect(suggestValues(songs, 'artist=queen album=')).toEqual(['A Night at the Opera']);
    expect(suggestValues(songs, 'artist=queen and coldplay album=')).toEqual(['Parachutes', 'A Night at the Opera']);
    expect(suggestValues(songs, 'year=2021 title=')).toEqual(['drivers license', 'good 4 u']);
  });

  it('suggests another value after "and", leaving out ones already chosen', () => {
    expect(suggestValues(songs, 'artist=queen and ')).toEqual(['Olivia Rodrigo', 'Coldplay']);
    expect(suggestValues(songs, 'artist=queen AND co')).toEqual(['Coldplay']);
  });

  it('suggests playlist names, one entry per playlist', () => {
    const tagged = [
      { title: 'a', artistName: 'Queen', playlistNames: ['Chill Mix', 'Gym'] },
      { title: 'b', artistName: 'Coldplay', playlistNames: ['Gym'] },
      { title: 'c', artistName: 'Queen', playlistNames: [] },
    ];
    expect(suggestValues(tagged, 'playlist=')).toEqual(['Chill Mix', 'Gym']);
    expect(suggestValues(tagged, 'artist=coldplay playlist=')).toEqual(['Gym']);
    expect(suggestKey('p')).toBe('playlist');
  });
});
