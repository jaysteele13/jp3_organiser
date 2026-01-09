import { ActionMenu } from '../../../../../components';
import styles from './ArtistView.module.css'

export default function ArtistView({ library, onDeleteArtist }) {
    return (
       <div className={styles.cardGrid}>
            {library.artists.map((artist) => {
                const artistSongs = library.songs.filter(s => s.artistId === artist.id);
                const artistAlbums = library.albums.filter(a => a.artistId === artist.id);
                return (
                <div key={artist.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardInfo}>
                            <div className={styles.cardTitle}>{artist.name}</div>
                        </div>
                        <ActionMenu
                            items={[
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
    )
}
