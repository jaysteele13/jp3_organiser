/**
 * AlbumView Component
 * 
 * Displays albums in a card grid format.
 * Album names are clickable links that navigate to the Player album detail page.
 * Artist names are also clickable links that navigate to the Player artist detail page.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionMenu } from '../../../../../components';
import styles from './AlbumView.module.css';

export default function AlbumView({ library, onDeleteAlbum, onEditAlbum }) {
  const navigate = useNavigate();

  const handleAlbumClick = useCallback((albumId) => {
    navigate(`/player/album/${albumId}`);
  }, [navigate]);

  const handleArtistClick = useCallback((artistId, e) => {
    e.stopPropagation();
    navigate(`/player/artist/${artistId}`);
  }, [navigate]);

  return (
    <div className={styles.cardGrid}>
      {library.albums.map((album) => {
        const albumSongs = library.songs.filter(s => s.albumId === album.id);
        return (
          <div key={album.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardInfo}>
                <div className={styles.scrollContainer}>
                  <span
                    className={styles.cardTitleLink}
                    onClick={() => handleAlbumClick(album.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAlbumClick(album.id)}
                    role="link"
                    tabIndex={0}
                  >
                    {album.name}
                  </span>
                </div>
                <div className={styles.scrollContainer}>
                  <span
                    className={styles.cardSubtitleLink}
                    onClick={(e) => handleArtistClick(album.artistId, e)}
                    onKeyDown={(e) => e.key === 'Enter' && handleArtistClick(album.artistId, e)}
                    role="link"
                    tabIndex={0}
                  >
                    {album.artistName}
                  </span>
                </div>
              </div>
              <ActionMenu
                items={[
                  { label: 'Edit Album', onClick: () => onEditAlbum?.(album) },
                  { label: 'Delete Album', onClick: () => onDeleteAlbum?.(album), variant: 'danger' },
                ]}
              />
            </div>
            <div className={styles.cardMeta}>
              {album.year > 0 && <span>{album.year}</span>}
              <span>{albumSongs.length} song(s)</span>
            </div>
          </div>
        );
      })}
      {library.albums.length === 0 && (
        <div className={styles.emptyTable}>No albums in library</div>
      )}
    </div>
  );
}
