import { formatDuration } from '../../../../../utils/formatters';
import styles from './SongView.module.css'

export default function SongView({ library, onDeleteSong, onEditSong }) {
  const handleDeleteClick = (e, song) => {
    e.stopPropagation();
    if (onDeleteSong) {
      onDeleteSong(song);
    }
  };

  const handleEditClick = (e, song) => {
    e.stopPropagation();
    if (onEditSong) {
      onEditSong(song);
    }
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
            <th className={styles.actionsHeader}>Actions</th>
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
              <td className={styles.cellActions}>
                <button 
                  className={styles.editBtn}
                  onClick={(e) => handleEditClick(e, song)}
                  title="Edit metadata"
                >
                  e
                </button>
                <button 
                  className={styles.deleteBtn}
                  onClick={(e) => handleDeleteClick(e, song)}
                  title="Delete song"
                >
                  x
                </button>
              </td>
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
