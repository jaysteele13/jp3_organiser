import { describe, it, expect } from 'vitest';
import { collageAlbums } from './playlistCovers';

const song = (albumName, artistName = 'Queen') => ({ artistName, albumName });
const albumNames = (songs) => collageAlbums(songs).map(({ album }) => album);

describe('collageAlbums', () => {
  it('counts each album once, in playlist order', () => {
    expect(albumNames([song('Jazz'), song('jazz'), song('Jazz')])).toEqual(['Jazz']);
    expect(albumNames([song('Jazz'), song('Innuendo'), song('Jazz')])).toEqual(['Jazz', 'Innuendo']);
  });

  it('treats the same album name by another artist as a different album', () => {
    expect(collageAlbums([song('Greatest Hits'), song('Greatest Hits', 'ABBA')])).toHaveLength(2);
  });

  it('shows two covers for three albums and the first four for five', () => {
    expect(albumNames([song('A'), song('B'), song('C')])).toEqual(['A', 'B']);
    expect(albumNames([song('A'), song('B'), song('C'), song('D'), song('E')])).toEqual(['A', 'B', 'C', 'D']);
  });

  it('gives nothing for an empty playlist or songs without an album', () => {
    expect(collageAlbums([])).toEqual([]);
    expect(collageAlbums([song(''), song(null)])).toEqual([]);
  });
});
