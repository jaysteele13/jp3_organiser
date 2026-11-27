/**
 * TabContent Component
 * 
 * Renders the appropriate content based on the active tab.
 * 
 * Props:
 * - activeTab: string - current active tab from TABS enum
 * - library: object - library data
 * - libraryPath: string - base library path (for cover art loading)
 */

import React, { useMemo } from 'react';
import { TABS } from '../../../utils/enums';
import { filterByQuery, filterPlaylistsByQuery } from '../../../utils/songFilter';
import { useTextFilter } from '../../../hooks';
import { QueryFilterBar } from '../../../components';
import { HomeView } from './Home';
import SongList from './SongList';
import AlbumList from './AlbumList';
import ArtistList from './ArtistList';
import PlaylistList from './PlaylistList';

export default function TabContent({ activeTab, library, libraryPath }) {
  // Albums, artists and playlists keep only those with a song matching the command bar query (SongList filters itself)
  const [textFilter] = useTextFilter();
  const songs = library.songs || [];
  const albums = useMemo(
    () => filterByQuery(library.albums || [], songs, textFilter, 'albumId'),
    [library.albums, songs, textFilter]
  );
  const artists = useMemo(
    () => filterByQuery(library.artists || [], songs, textFilter, 'artistId'),
    [library.artists, songs, textFilter]
  );
  const playlists = useMemo(
    () => filterPlaylistsByQuery(library.playlists || [], songs, textFilter),
    [library.playlists, songs, textFilter]
  );
  const filterBar = <QueryFilterBar tab={activeTab} clearText="Show all" />;

  switch (activeTab) {
    case TABS.HOME:
      return <HomeView library={library} libraryPath={libraryPath} />;
    case TABS.SONGS:
      return <SongList songs={songs} />;
    case TABS.ALBUMS:
      return <>{filterBar}<AlbumList albums={albums} songs={songs} libraryPath={libraryPath} /></>;
    case TABS.ARTISTS:
      return <>{filterBar}<ArtistList artists={artists} songs={songs} libraryPath={libraryPath} /></>;
    case TABS.PLAYLISTS:
      return <>{filterBar}<PlaylistList playlists={playlists} songs={songs} /></>;
    default:
      return null;
  }
}
