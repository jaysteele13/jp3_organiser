export const TABS = {
  HOME: 'home',
  SONGS: 'songs',
  ALBUMS: 'albums',
  ARTISTS: 'artists',
  PLAYLISTS: 'playlists',
};

export const PLAYER_TABS = {
  HOME: TABS.HOME,
  SONGS: TABS.SONGS,
  ALBUMS: TABS.ALBUMS,
  ARTISTS: TABS.ARTISTS,
  PLAYLISTS: TABS.PLAYLISTS
}

export const VIEW_TABS = {
  SONGS: TABS.SONGS,
  ALBUMS: TABS.ALBUMS,
  ARTISTS: TABS.ARTISTS,
  PLAYLISTS: TABS.PLAYLISTS
}

// Map tab keys to image assets (still + variants)
export const TAB_IMAGES = {
    HOME: {
        still_w: '/src/assets/categories/home_w_still.png',
        still_b: '/src/assets/categories/home_b_still.png',
        gif_w: '/src/assets/categories/home_w_noBG.gif',
        gif_b: '/src/assets/categories/home_noBG.gif',
    },
    SONGS: {
        still_w: '/src/assets/categories/song_w_still.png',
        still_b: '/src/assets/categories/song_b_still.png',
        gif_w: '/src/assets/categories/song_w_noBG.gif',
        gif_b: '/src/assets/categories/song_noBG.gif',
    },
    ALBUMS: {
        still_w: '/src/assets/categories/album_w_still.png',
        still_b: '/src/assets/categories/album_b_still.png',
        gif_w: '/src/assets/categories/album_w_noBG.gif',
        gif_b: '/src/assets/categories/album_noBG.gif',
    },
    ARTISTS: {
        still_w: '/src/assets/categories/artist_w_still.png',
        still_b: '/src/assets/categories/artist_b_still.png',
        gif_w: '/src/assets/categories/artist_w_noBG.gif',
        gif_b: '/src/assets/categories/artist_noBG.gif',
    },
    PLAYLISTS: {
        still_w: '/src/assets/categories/playlist_w_still.png',
        still_b: '/src/assets/categories/playlist_b_still.png',
        gif_w: '/src/assets/categories/playlist_w_noBG.gif',
        gif_b: '/src/assets/categories/playlist_noBG.gif',
    },
};

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