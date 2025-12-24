import styles from './AlbumView.module.css'

export default function AlbumView({ library }) {
    
    return (
       <div className={styles.cardGrid}>
            {library.albums.map((album) => {
                const albumSongs = library.songs.filter(s => s.albumId === album.id);
                return (
                <div key={album.id} className={styles.card}>
                    <div className={styles.cardTitle}>{album.name}</div>
                    <div className={styles.cardSubtitle}>{album.artistName}</div>
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