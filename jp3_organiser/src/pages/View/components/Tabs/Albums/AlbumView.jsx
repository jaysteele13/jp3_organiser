import { ActionMenu } from '../../../../../components';
import styles from './AlbumView.module.css'

export default function AlbumView({ library, onDeleteAlbum }) {
    
    return (
       <div className={styles.cardGrid}>
            {library.albums.map((album) => {
                const albumSongs = library.songs.filter(s => s.albumId === album.id);
                return (
                <div key={album.id} className={styles.card}>
                    <div className={styles.cardHeader}>
                        <div className={styles.cardInfo}>
                            <div className={styles.cardTitle}>{album.name}</div>
                            <div className={styles.cardSubtitle}>{album.artistName}</div>
                        </div>
                        <ActionMenu
                            items={[
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
    )
}
