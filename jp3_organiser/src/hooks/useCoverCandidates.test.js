// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCoverCandidates, SEARCH_STATUS, NO_COVER } from './useCoverCandidates';
import { searchCoverCandidates, setCoverFromUrl, setCoverFromBytes, removeCover } from '../services/coverArtService';
import { removeAlbumNotFound, markAlbumCoverNotFound } from '../services/coverArtNotFoundStore';
import { COVER_KIND } from '../utils/enums';

vi.mock('../services/coverArtService', () => ({
  searchCoverCandidates: vi.fn(),
  setCoverFromUrl: vi.fn(),
  setCoverFromBytes: vi.fn(),
  removeCover: vi.fn(),
}));
vi.mock('../services/coverArtNotFoundStore', () => ({
  removeAlbumNotFound: vi.fn(),
  removeArtistNotFound: vi.fn(),
  markAlbumCoverNotFound: vi.fn(),
  markArtistCoverNotFound: vi.fn(),
}));

const album = { kind: COVER_KIND.ALBUM, artist: 'Radiohead', album: 'OK Computer' };
const image = { url: 'https://cdn-images.dzcdn.net/big.jpg', thumbUrl: 'https://cdn-images.dzcdn.net/small.jpg', source: 'Deezer' };

beforeEach(() => vi.clearAllMocks());

describe('useCoverCandidates', () => {
  it('lists the images found for the album, then adds avatars after them on request', async () => {
    searchCoverCandidates.mockResolvedValue([image]);

    const { result } = renderHook(() => useCoverCandidates('/music', album));

    expect(result.current.status).toBe(SEARCH_STATUS.SEARCHING);
    await waitFor(() => expect(result.current.status).toBe(SEARCH_STATUS.READY));
    expect(result.current.candidates).toEqual([image]);

    act(() => result.current.showAvatars());

    expect(result.current.candidates[0]).toEqual(image);
    expect(result.current.candidates).toHaveLength(11);
  });

  it('saves the selected image and forgets that the cover was not found', async () => {
    searchCoverCandidates.mockResolvedValue([image]);
    const { result } = renderHook(() => useCoverCandidates('/music', album));
    await waitFor(() => expect(result.current.status).toBe(SEARCH_STATUS.READY));

    act(() => result.current.setSelected(image));
    await act(() => result.current.save());

    expect(setCoverFromUrl).toHaveBeenCalledWith('/music', 'album', 'Radiohead', 'OK Computer', image.url);
    expect(removeAlbumNotFound).toHaveBeenCalledWith('Radiohead', 'OK Computer');
    expect(result.current.isSaving).toBe(false);
  });

  it('removes the cover and stops looking it up when "No cover" is saved', async () => {
    searchCoverCandidates.mockResolvedValue([image]);
    const { result } = renderHook(() => useCoverCandidates('/music', album));
    await waitFor(() => expect(result.current.status).toBe(SEARCH_STATUS.READY));

    act(() => result.current.setSelected(NO_COVER));
    await act(() => result.current.save());

    expect(removeCover).toHaveBeenCalledWith('/music', 'album', 'Radiohead', 'OK Computer');
    expect(markAlbumCoverNotFound).toHaveBeenCalledWith('Radiohead', 'OK Computer');
    expect(setCoverFromUrl).not.toHaveBeenCalled();
  });

  it('saves a bundled placeholder from its bytes, because it has no web address', async () => {
    searchCoverCandidates.mockResolvedValue([]);
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })));
    const { result } = renderHook(() => useCoverCandidates('/music', album));
    await waitFor(() => expect(result.current.status).toBe(SEARCH_STATUS.READY));

    act(() => result.current.showPlaceholders());
    const placeholder = result.current.candidates[0];
    act(() => result.current.setSelected(placeholder));
    await act(() => result.current.save());

    expect(fetch).toHaveBeenCalledWith(placeholder.url);
    expect(setCoverFromBytes).toHaveBeenCalledWith('/music', 'album', 'Radiohead', 'OK Computer', [1, 2, 3]);
    expect(setCoverFromUrl).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
