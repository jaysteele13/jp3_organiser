import { describe, expect, it } from 'vitest';
import { filterByQuery, filterPlaylistsByQuery, filterSongsByText, withPlaylistNames } from './songFilter';

const songs = [
  { id: 1, title: 'drivers license', artistName: 'Olivia Rodrigo', albumName: 'SOUR', year: 2021 },
  { id: 2, title: 'Olivia', artistName: 'One Direction', albumName: 'Made in the A.M.', year: 2015 },
  { id: 3, title: 'Yellow', artistName: 'Coldplay', albumName: 'Parachutes', year: 2000 },
];

const ids = (text) => filterSongsByText(songs, text).map((song) => song.id);

describe('filterSongsByText', () => {
  it('matches title, artist or album, ignoring case', () => {
    expect(ids('OLIVIA')).toEqual([1, 2]);
    expect(ids('parachutes')).toEqual([3]);
  });

  it('returns every song for empty or blank text', () => {
    expect(filterSongsByText(songs, '')).toBe(songs);
    expect(filterSongsByText(songs, '   ')).toBe(songs);
  });

  it('returns nothing when no field matches, including songs with missing fields', () => {
    expect(ids('zzz')).toEqual([]);
    expect(filterSongsByText([{ id: 4 }], 'a')).toEqual([]);
  });

  it('narrows to one field with key=value, and every term must match', () => {
    expect(ids('title=olivia')).toEqual([2]);
    expect(ids('artist=OLIVIA')).toEqual([1]);
    expect(ids('album=parachutes')).toEqual([3]);
    expect(ids('year=2021')).toEqual([1]);
    expect(ids('olivia year=2015')).toEqual([2]);
    expect(ids('artist=olivia rodrigo')).toEqual([1]);
    expect(ids('genre=pop')).toEqual([]);
  });

  it('treats a quoted value as one phrase, even when the quote is left open', () => {
    expect(ids('artist="one direction"')).toEqual([2]);
    expect(ids('"olivia rodrigo" year=2021')).toEqual([1]);
    expect(ids('artist="rodrigo olivia"')).toEqual([]);
    expect(ids('artist="one dir')).toEqual([2]);
  });

  it('accepts several values for one key joined by "and" (a song may match any of them)', () => {
    expect(ids('artist=olivia and coldplay')).toEqual([1, 3]);
    expect(ids('artist=olivia AND coldplay year=2000')).toEqual([3]);
    expect(ids('artist=olivia and ')).toEqual([1]);
    expect(ids('olivia and coldplay')).toEqual([]);
  });

  it('keeps the artists or albums that have a matching song', () => {
    const tagged = songs.map((song) => ({ ...song, artistId: song.id * 10 }));
    const artists = [{ id: 10, name: 'Olivia Rodrigo' }, { id: 20, name: 'One Direction' }, { id: 30, name: 'Coldplay' }];
    expect(filterByQuery(artists, tagged, 'year=2015 and 2000', 'artistId').map((a) => a.id)).toEqual([20, 30]);
    expect(filterByQuery(artists, tagged, ' ', 'artistId')).toBe(artists);
  });

  it('keeps the playlists that contain a matching song', () => {
    const playlists = [{ id: 1, songIds: [1, 3] }, { id: 2, songIds: [2] }, { id: 3 }];
    expect(filterPlaylistsByQuery(playlists, songs, 'artist=coldplay').map((p) => p.id)).toEqual([1]);
    expect(filterPlaylistsByQuery(playlists, songs, '')).toBe(playlists);
  });

  it('filters by playlist= once songs are tagged with their playlists', () => {
    const playlists = [{ name: 'Chill Mix', songIds: [1, 3] }, { name: 'Gym', songIds: [3, 99] }];
    const tagged = withPlaylistNames(songs, playlists);
    expect(tagged.map((song) => song.playlistNames)).toEqual([['Chill Mix'], [], ['Chill Mix', 'Gym']]);

    const taggedIds = (text) => filterSongsByText(tagged, text).map((song) => song.id);
    expect(taggedIds('playlist=chill')).toEqual([1, 3]);
    expect(taggedIds('playlist=gym and chill artist=olivia')).toEqual([1]);
    expect(taggedIds('chill')).toEqual([]);
  });
});
