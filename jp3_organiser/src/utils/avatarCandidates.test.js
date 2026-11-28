import { describe, it, expect } from 'vitest';
import { avatarCandidates, AVATAR_STYLES } from './avatarCandidates';

describe('avatarCandidates', () => {
  it('offers two avatars in each of the five allowed styles', () => {
    const avatars = avatarCandidates('Radiohead');

    expect(AVATAR_STYLES).toEqual(['pixel-art', 'personas', 'open-peeps', 'croodles', 'big-ears']);
    expect(avatars).toHaveLength(10);
    for (const style of AVATAR_STYLES) {
      expect(avatars.filter((avatar) => avatar.url.includes(`/9.x/${style}/jpg?`))).toHaveLength(2);
    }
    expect(new Set(avatars.map((avatar) => avatar.url)).size).toBe(10);
  });

  it('gives the same avatars for the same name every time', () => {
    expect(avatarCandidates('Radiohead', 'OK Computer')).toEqual(avatarCandidates('Radiohead', 'OK Computer'));
  });

  it('encodes names so spaces and symbols cannot break the URL', () => {
    const { url } = avatarCandidates('AC/DC & Friends?')[0];

    expect(url).toContain('seed=AC%2FDC%20%26%20Friends%3F');
    expect(new URL(url).hostname).toBe('api.dicebear.com');
  });
});
