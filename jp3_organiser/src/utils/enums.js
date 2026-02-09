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

import eyes_still from '../assets/review_files/eyes_search_b_still.png';
import eyes_gif from '../assets/review_files/eyes_search_b.gif'

export const REVIEW_IMAGES = {
  REVIEW: {
    still: eyes_still,
    gif: eyes_gif,
  }
}

// Import all images at the top
import homeWStill from '../assets/categories/home_w_still.png';
import homeBStill from '../assets/categories/home_b_still.png';
import homeWGif from '../assets/categories/home_w_noBG.gif';
import homeBGif from '../assets/categories/home_noBG.gif';

import songWStill from '../assets/categories/song_w_still.png';
import songBStill from '../assets/categories/song_b_still.png';
import songWGif from '../assets/categories/song_w_noBG.gif';
import songBGif from '../assets/categories/song_noBG.gif';

import albumWStill from '../assets/categories/album_w_still.png';
import albumBStill from '../assets/categories/album_b_still.png';
import albumWGif from '../assets/categories/album_w_noBG.gif';
import albumBGif from '../assets/categories/album_noBG.gif';

import artistWStill from '../assets/categories/artist_w_still.png';
import artistBStill from '../assets/categories/artist_b_still.png';
import artistWGif from '../assets/categories/artist_w_noBG.gif';
import artistBGif from '../assets/categories/artist_noBG.gif';

import playlistWStill from '../assets/categories/playlist_w_still.png';
import playlistBStill from '../assets/categories/playlist_b_still.png';
import playlistWGif from '../assets/categories/playlist_w_noBG.gif';
import playlistBGif from '../assets/categories/playlist_noBG.gif';

// Use the imported variables
export const TAB_IMAGES = {
    HOME: {
        still_w: homeWStill,
        still_b: homeBStill,
        gif_w: homeWGif,
        gif_b: homeBGif,
    },
    SONGS: {
        still_w: songWStill,
        still_b: songBStill,
        gif_w: songWGif,
        gif_b: songBGif,
    },
    ALBUMS: {
        still_w: albumWStill,
        still_b: albumBStill,
        gif_w: albumWGif,
        gif_b: albumBGif,
    },
    ARTISTS: {
        still_w: artistWStill,
        still_b: artistBStill,
        gif_w: artistWGif,
        gif_b: artistBGif,
    },
    PLAYLISTS: {
        still_w: playlistWStill,
        still_b: playlistBStill,
        gif_w: playlistWGif,
        gif_b: playlistBGif,
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
  SONG: 'Song',
};