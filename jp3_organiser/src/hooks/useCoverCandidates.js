/**
 * useCoverCandidates Hook
 *
 * Powers the "Edit Cover Art" picker: searches online for images of one
 * album or artist, tracks which image is selected, and saves it as the cover.
 * `showAvatars` adds fun avatars after the images found, and `showPlaceholders`
 * swaps those avatars for the bundled images if they cannot load.
 * `uploadImage` lets the user choose an image file from their computer instead;
 * a file over 5 MB is refused and explained in `uploadError`.
 *
 * For a playlist, `artist` is the playlist ID and nothing is searched for.
 *
 * @param {string} libraryPath - Base library path
 * @param {{kind: string, artist: string, album: string|null}} target - What the cover is for (kind is a COVER_KIND)
 * @returns {{candidates: Array, status: string, selected: Object|null, setSelected: Function, showAvatars: Function, showPlaceholders: Function, uploadImage: Function, uploadError: string|null, isSaving: boolean, save: Function}}
 */

import { useState, useEffect, useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { searchCoverCandidates, setCoverFromUrl, setCoverFromBytes, removeCover } from '../services/coverArtService';
import {
  removeAlbumNotFound,
  removeArtistNotFound,
  markAlbumCoverNotFound,
  markArtistCoverNotFound,
} from '../services/coverArtNotFoundStore';
import { COVER_KIND } from '../utils/enums';
import { avatarCandidates, AVATAR_SOURCE, BUNDLED_CANDIDATES } from '../utils/avatarCandidates';

export const SEARCH_STATUS = {
  SEARCHING: 'searching',
  READY: 'ready',
  ERROR: 'error',
};

// Selecting this instead of an image removes the cover, so the placeholder shows
export const NO_COVER = { source: 'No cover' };

const UPLOAD_SOURCE = 'Your image';
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_UPLOAD_MB = 5;

export function useCoverCandidates(libraryPath, { kind, artist, album }) {
  const [candidates, setCandidates] = useState([]);
  const [status, setStatus] = useState(SEARCH_STATUS.SEARCHING);
  const [selected, setSelected] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    let isCurrent = true;
    setStatus(SEARCH_STATUS.SEARCHING);

    searchCoverCandidates(kind, artist, album)
      .then((found) => {
        if (!isCurrent) return;
        setCandidates(found);
        setStatus(SEARCH_STATUS.READY);
      })
      .catch((err) => {
        console.error('Cover art search failed:', err);
        if (isCurrent) setStatus(SEARCH_STATUS.ERROR);
      });

    return () => {
      isCurrent = false;
    };
  }, [kind, artist, album]);

  const showAvatars = useCallback(
    () => setCandidates((found) => [...found, ...avatarCandidates(artist, album)]),
    [artist, album]
  );

  const showPlaceholders = useCallback(() => {
    const isAvatar = (candidate) => candidate?.source === AVATAR_SOURCE;

    setSelected((current) => (isAvatar(current) ? null : current));
    setCandidates((shown) => [...shown.filter((candidate) => !isAvatar(candidate)), ...BUNDLED_CANDIDATES]);
  }, []);

  // Opens a file chooser; the chosen image becomes the first, selected candidate
  const uploadImage = useCallback(async () => {
    const path = await open({ multiple: false, filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }] });
    if (!path) return;

    const bytes = await readFile(path);
    const isTooLarge = bytes.length > MAX_UPLOAD_MB * 1024 * 1024;
    setUploadError(isTooLarge ? `That image is larger than ${MAX_UPLOAD_MB} MB. Choose a smaller one.` : null);
    if (isTooLarge) return;

    const url = URL.createObjectURL(new Blob([bytes]));
    const uploaded = { url, thumbUrl: url, source: UPLOAD_SOURCE, bytes };

    setCandidates((shown) => [uploaded, ...shown.filter((candidate) => candidate.source !== UPLOAD_SOURCE)]);
    setSelected(uploaded);
  }, []);

  // Rejects if the image could not be saved, so the caller can show the error
  const save = useCallback(async () => {
    if (!selected) return;

    setIsSaving(true);
    try {
      const isAlbum = kind === COVER_KIND.ALBUM;
      // Playlists have no automatic lookup, so there is nothing to remember about it
      const hasLookup = kind !== COVER_KIND.PLAYLIST;

      if (selected === NO_COVER) {
        await removeCover(libraryPath, kind, artist, album);
        // Marked as not found so the automatic lookup does not bring a cover back
        if (hasLookup) await (isAlbum ? markAlbumCoverNotFound(artist, album) : markArtistCoverNotFound(artist));
      } else {
        // Uploaded and bundled images have no web address, so their bytes are saved
        const bytes =
          selected.bytes ?? (selected.isBundled ? new Uint8Array(await (await fetch(selected.url)).arrayBuffer()) : null);
        if (bytes) {
          await setCoverFromBytes(libraryPath, kind, artist, album, Array.from(bytes));
        } else {
          await setCoverFromUrl(libraryPath, kind, artist, album, selected.url);
        }
        if (hasLookup) await (isAlbum ? removeAlbumNotFound(artist, album) : removeArtistNotFound(artist));
      }
    } finally {
      setIsSaving(false);
    }
  }, [libraryPath, kind, artist, album, selected]);

  return { candidates, status, selected, setSelected, showAvatars, showPlaceholders, uploadImage, uploadError, isSaving, save };
}

export default useCoverCandidates;
