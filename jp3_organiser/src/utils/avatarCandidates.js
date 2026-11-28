/**
 * Fun avatars from DiceBear (https://www.dicebear.com), offered in the
 * "Edit Cover Art" picker when no real image is found, and the images
 * bundled with the app that replace them when DiceBear cannot be reached.
 *
 * DiceBear draws an avatar from a "seed" text: the same seed always gives
 * the same avatar. No API key is needed.
 */

import albumPlaceholder from '../assets/icon_placeholder/album_placeholder.png';
import artistPlaceholder0 from '../assets/artist_placeholders/0.png';
import artistPlaceholder1 from '../assets/artist_placeholders/1.png';
import artistPlaceholder2 from '../assets/artist_placeholders/2.png';
import artistPlaceholder3 from '../assets/artist_placeholders/3.png';

export const AVATAR_SOURCE = 'Avatar';

/** Offline stand-ins for the avatars. `isBundled` means the image is saved from its bytes, not downloaded. */
export const BUNDLED_CANDIDATES = [
  albumPlaceholder,
  artistPlaceholder0,
  artistPlaceholder1,
  artistPlaceholder2,
  artistPlaceholder3,
].map((url) => ({ url, thumbUrl: url, source: 'Placeholder', isBundled: true }));

export const AVATAR_STYLES = ['pixel-art', 'personas', 'open-peeps', 'croodles', 'big-ears'];

const AVATARS_PER_STYLE = 2;

function avatarUrl(style, seed, size) {
  return `https://api.dicebear.com/9.x/${style}/jpg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

/**
 * Build the avatars for an artist, or for an album when `album` is given.
 * Each has the same shape as a search result: { url, thumbUrl, source }.
 *
 * @param {string} artist - Artist name
 * @param {string|null} [album=null] - Album name, or null for an artist
 * @returns {Array<{url: string, thumbUrl: string, source: string}>} Two avatars per style
 */
export function avatarCandidates(artist, album = null) {
  const name = album ? `${artist} ${album}` : artist;

  return AVATAR_STYLES.flatMap((style) =>
    Array.from({ length: AVATARS_PER_STYLE }, (_, variant) => {
      const seed = `${name} ${variant + 1}`;
      return {
        url: avatarUrl(style, seed, 512),
        thumbUrl: avatarUrl(style, seed, 128),
        source: AVATAR_SOURCE,
      };
    })
  );
}
