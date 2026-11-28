import { describe, it, expect, vi } from 'vitest';
import { isAlbumCoverNotFound, isArtistCoverNotFound } from './coverArtNotFoundStore';

vi.mock('@tauri-apps/plugin-store', () => {
  const A_YEAR_AGO = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const saved = {
    notFound: {
      'album:radiohead|||ok computer': A_YEAR_AGO,
      'artist:radiohead|||': A_YEAR_AGO,
    },
  };
  const store = {
    get: async (key) => saved[key],
    set: async (key, value) => {
      saved[key] = value;
    },
  };
  return { load: async () => store };
});

describe('coverArtNotFoundStore', () => {
  it('keeps a cover marked as not found however long ago it was marked', async () => {
    expect(await isAlbumCoverNotFound('Radiohead', 'OK Computer')).toBe(true);
    expect(await isArtistCoverNotFound('Radiohead')).toBe(true);
  });

  it('does not report covers that were never marked', async () => {
    expect(await isAlbumCoverNotFound('Radiohead', 'Kid A')).toBe(false);
  });
});
