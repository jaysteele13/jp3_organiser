export default function SongView(library) {
      // Format duration from seconds to MM:SS
  const formatDuration = (seconds) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
    
    return (
        <div className={styles.tableContainer}>
            <table className={styles.table}>
                <thead>
                <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Artist</th>
                    <th>Album</th>
                    <th>Duration</th>
                    <th>Path</th>
                </tr>
                </thead>
                <tbody>
                {library.songs.map((song, index) => (
                    <tr key={song.id}>
                    <td className={styles.cellNum}>{index + 1}</td>
                    <td className={styles.cellTitle}>{song.title}</td>
                    <td>{song.artistName}</td>
                    <td>{song.albumName}</td>
                    <td className={styles.cellDuration}>
                        {formatDuration(song.durationSec)}
                    </td>
                    <td className={styles.cellPath}>{song.path}</td>
                    </tr>
                ))}
                </tbody>
            </table>
            {library.songs.length === 0 && (
                <div className={styles.emptyTable}>No songs in library</div>
            )}
        </div>
    )
}