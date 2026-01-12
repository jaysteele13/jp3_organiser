/**
 * ArtistView Component
 * 
 * Displays artists in a card grid format.
 * Artist names are clickable links that navigate to the Player artist detail page.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActionMenu } from '../../../../../components';
import styles from './ArtistView.module.css';

export default function ArtistView({ library, onDeleteArtist, onEditArtist }) {
  const navigate = useNavigate();

  const handleArtistClick = useCallback((artistId) => {
    navigate(`/player/artist/${artistId}`);
  }, [navigate]);

  return (
    <div className={styles.cardGrid}>
      {library.artists.map((artist) => {
        const artistSongs = library.songs.filter(s => s.artistId === artist.id);
        const artistAlbums = library.albums.filter(a => a.artistId === artist.id);
        return (
          <div key={artist.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardInfo}>
                <div className={styles.scrollContainer}>
                  <span
                    className={styles.cardTitleLink}
                    onClick={() => handleArtistClick(artist.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleArtistClick(artist.id)}
                    role="link"
                    tabIndex={0}
                  >
                    {artist.name}
                  </span>
                </div>
              </div>
              <ActionMenu
                items={[
                  { label: 'Edit Artist', onClick: () => onEditArtist?.(artist) },
                  { label: 'Delete Artist', onClick: () => onDeleteArtist?.(artist), variant: 'danger' },
                ]}
              />
            </div>
            <div className={styles.cardMeta}>
              <span>{artistAlbums.length} album(s)</span>
              <span>{artistSongs.length} song(s)</span>
            </div>
          </div>
        );
      })}
      {library.artists.length === 0 && (
        <div className={styles.emptyTable}>No artists in library</div>
      )}
    </div>
  );
}
