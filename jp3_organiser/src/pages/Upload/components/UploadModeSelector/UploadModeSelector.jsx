/**
 * UploadModeSelector Component
 * 
 * Displays four mode options for adding music:
 * - Add Songs: Auto-detect everything via AcousticID
 * - Add Album: User specifies album + artist upfront
 * - Add Artist: User specifies artist upfront
 * - Add Playlist: User specifies playlist name, songs added to new playlist
 * 
 * @param {Object} props
 * @param {function} props.onSelectSongs - Called when "Add Songs" is selected
 * @param {function} props.onSelectAlbum - Called when "Add Album" is selected
 * @param {function} props.onSelectArtist - Called when "Add Artist" is selected
 * @param {function} props.onSelectPlaylist - Called when "Add Playlist" is selected
 */

import styles from './UploadModeSelector.module.css';
import songGif from '../../../../assets/categories/song_w_noBG.gif'
import artistGif from '../../../../assets/categories/artist_w_noBG.gif'
import albumGif from '../../../../assets/categories/album_w_noBG.gif'
import playlistGif from '../../../../assets/categories/playlist_w_noBG.gif'

import songStill from '../../../../assets/categories/song_still.png'
import artistStill from '../../../../assets/categories/artist_still.png'
import albumStill from '../../../../assets/categories/album_still.png'
import playlistStill from '../../../../assets/categories/playlist_still.png'

import ModeImage from './ModeImage';

import { useState } from 'react';

export default function UploadModeSelector({ 
  onSelectSongs, 
  onSelectAlbum, 
  onSelectArtist,
  onSelectPlaylist,
}) {
  const [hovered, setHovered] = useState(null);

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>How would you like to add music?</h3>

      <div className={styles.modeGrid}>
        {/* Add Songs - default behavior */}
        <button
          className={styles.modeCard}
          onClick={onSelectSongs}
          onMouseEnter={() => setHovered('songs')}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered('songs')}
          onBlur={() => setHovered(null)}
          onTouchStart={() => setHovered(h => (h === 'songs' ? null : 'songs'))}
        >
          <ModeImage still={songStill} gif={songGif} alt={"Add Songs"} className={styles.modeImage} playing={hovered === 'songs'} />
        </button>

        {/* Add Album */}
        <button
          className={styles.modeCard}
          onClick={onSelectAlbum}
          onMouseEnter={() => setHovered('album')}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered('album')}
          onBlur={() => setHovered(null)}
          onTouchStart={() => setHovered(h => (h === 'album' ? null : 'album'))}
        >
          <ModeImage still={albumStill} gif={albumGif} alt={"Add Album"} className={styles.modeImage} playing={hovered === 'album'} />
        </button>

        {/* Add Artist */}
        <button
          className={styles.modeCard}
          onClick={onSelectArtist}
          onMouseEnter={() => setHovered('artist')}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered('artist')}
          onBlur={() => setHovered(null)}
          onTouchStart={() => setHovered(h => (h === 'artist' ? null : 'artist'))}
        >
          <ModeImage still={artistStill} gif={artistGif} alt={"Add Artist"} className={styles.modeImage} playing={hovered === 'artist'} />
        </button>

        {/* Add Playlist */}
        <button
          className={styles.modeCard}
          onClick={onSelectPlaylist}
          onMouseEnter={() => setHovered('playlist')}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered('playlist')}
          onBlur={() => setHovered(null)}
          onTouchStart={() => setHovered(h => (h === 'playlist' ? null : 'playlist'))}
        >
          <ModeImage still={playlistStill} gif={playlistGif} alt={"Add Playlist"} className={styles.modeImage} playing={hovered === 'playlist'} />
        </button>
      </div>

      <p className={styles.hint}>
        All modes use audio fingerprinting to identify songs. 
        Album and Artist modes override unreliable API results with your input.
      </p>
    </div>
  );
}
