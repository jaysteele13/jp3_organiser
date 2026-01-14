export const TABS = {
  HOME: 'home',
  SONGS: 'songs',
  ALBUMS: 'albums',
  ARTISTS: 'artists',
  PLAYLISTS: 'playlists',
};

export const VIEW_TABS = {
  SONGS: TABS.SONGS,
  ALBUMS: TABS.ALBUMS,
  ARTISTS: TABS.ARTISTS,
  PLAYLISTS: TABS.PLAYLISTS
}
/**
 * Upload mode determines what context the user provides upfront
 * and how AcousticID results are applied.
 * 
 * SONGS: No context - AcousticID provides everything
 * ALBUM: User provides album + artist - AcousticID provides title, track, year
 * ARTIST: User provides artist - AcousticID provides album, title, track, year
 * PLAYLIST: User provides playlist name - songs saved to library and added to new playlist
 */
export const UPLOAD_MODE = {
  SONGS: 'songs',
  ALBUM: 'album',
  ARTIST: 'artist',
  PLAYLIST: 'playlist',
};

export const IMAGE_COVER_TYPE = {
  ALBUM: 'Album',
  ARTIST: 'Artist',
};