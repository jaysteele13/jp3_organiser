/**
 * AlbumView Component
 * 
 * Displays albums in a full-width card list format.
 * Album names are clickable links that navigate to the Player album detail page.
 * Artist names are also clickable links that navigate to the Player artist detail page.
 * 
 * Supports filtering via filter prop (from LibrarySearch).
 * When filtered, shows only the selected album.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardList, CoverArt, FilterBar } from '../../../../../components';
import styles from './AlbumView.module.css';

export default function AlbumView({ library, libraryPath, onDeleteAlbum, onEditAlbum, filter, onClearFilter }) {
  const navigate = useNavigate();

  // Pre-compute song counts for each album
  const albumSongCounts = useMemo(() => {
    const counts = {};
    library.songs.forEach(song => {
      counts[song.albumId] = (counts[song.albumId] || 0) + 1;
    });
    return counts;
  }, [library.songs]);

  // Filter albums if a filter is active
  const displayAlbums = useMemo(() => {
    if (!filter) {
      return library.albums;
    }
    return library.albums.filter(album => album.id === filter.id);
  }, [library.albums, filter]);

  const handleTitleClick = useCallback((album) => {
    navigate(`/player/album/${album.id}`);
  }, [navigate]);

  const handleSubtitleClick = useCallback((album, e) => {
    e.stopPropagation();
    navigate(`/player/artist/${album.artistId}`);
  }, [navigate]);

  const getTitle = useCallback((album) => album.name, []);
  
  const getSubtitle = useCallback((album) => album.artistName, []);
  
  const getMeta = useCallback((album) => {
    const meta = [];
    if (album.year > 0) meta.push(album.year.toString());
    meta.push(`${albumSongCounts[album.id] || 0} song(s)`);
    return meta;
  }, [albumSongCounts]);

  const getActions = useCallback((album) => [
    { label: 'Edit Album', onClick: () => onEditAlbum?.(album) },
    { label: 'Delete Album', onClick: () => onDeleteAlbum?.(album), variant: 'danger' },
  ], [onEditAlbum, onDeleteAlbum]);

  const renderThumbnail = useCallback((album) => (
    <CoverArt
      artist={album.artistName}
      album={album.name}
      libraryPath={libraryPath}
      size="large"
    />
  ), [libraryPath]);

  return (
    <div className={styles.container}>
      {filter && (
        <FilterBar
          label={filter.name}
          sublabel={`by ${filter.artistName}`}
          onClear={onClearFilter}
          clearText="Show all albums"
        />
      )}
      <CardList
        items={displayAlbums}
        getTitle={getTitle}
        getSubtitle={getSubtitle}
        getMeta={getMeta}
        onTitleClick={handleTitleClick}
        onSubtitleClick={handleSubtitleClick}
        getActions={getActions}
        renderThumbnail={renderThumbnail}
        emptyMessage="No albums in library"
      />
    </div>
  );
}
