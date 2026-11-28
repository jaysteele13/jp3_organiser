/**
 * AlbumView Component
 * 
 * Displays albums in a full-width card list format.
 * Album names are clickable links that navigate to the Player album detail page.
 * Artist names are also clickable links that navigate to the Player artist detail page.
 * 
 * Supports filtering via filter prop (one album, from Player links) and the "/" command bar query.
 * When filtered, shows only the selected album.
 */

import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CardList, CoverArt, FilterBar, QueryFilterBar } from '../../../../../components';
import { useTextFilter } from '../../../../../hooks';
import { TABS } from '../../../../../utils/enums';
import { filterByQuery } from '../../../../../utils/songFilter';
import { getCachedViewData } from '../../../utils/viewDataCache';
import styles from './AlbumView.module.css';

export default function AlbumView({ library, libraryPath, onDeleteAlbum, onEditAlbum, onEditCover, filter, onClearFilter }) {
  const navigate = useNavigate();
  const [textFilter] = useTextFilter();

  // Pre-compute song counts for each album
  const albumSongCounts = useMemo(() => {
    const counts = {};
    library.songs.forEach(song => {
      counts[song.albumId] = (counts[song.albumId] || 0) + 1;
    });
    return counts;
  }, [library.songs]);

  const displayAlbums = useMemo(() => {
    const cacheKey = `${filter?.id ?? 'all'}::${textFilter}`;
    return getCachedViewData(library.albums, cacheKey, () => {
      const albums = filter ? library.albums.filter(album => album.id === filter.id) : library.albums;
      return filterByQuery(albums, library.songs, textFilter, 'albumId');
    });
  }, [library.albums, library.songs, filter, textFilter]);

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
    { label: 'Edit Cover Art', onClick: () => onEditCover?.(album) },
    { label: 'Delete Album', onClick: () => onDeleteAlbum?.(album), variant: 'danger' },
  ], [onEditAlbum, onEditCover, onDeleteAlbum]);

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
        />
      )}
      <QueryFilterBar tab={TABS.ALBUMS} />
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
