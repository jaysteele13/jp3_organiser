export const TABS = {
  SONGS: 'songs',
  ALBUMS: 'albums',
  ARTISTS: 'artists',
  PLAYLISTS: 'playlists',
};

/**
 * Upload mode determines what context the user provides upfront
 * and how AcousticID results are applied.
 * 
 * SONGS: No context - AcousticID provides everything
 * ALBUM: User provides album + artist - AcousticID provides title, track, year
 * ARTIST: User provides artist - AcousticID provides album, title, track, year
 */
export const UPLOAD_MODE = {
  SONGS: 'songs',
  ALBUM: 'album',
  ARTIST: 'artist',
};
