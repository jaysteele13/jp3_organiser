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

import React from 'react';
import { TABS } from '../../../utils/enums';
import { HomeView } from './Home';
import SongList from './SongList';
import AlbumList from './AlbumList';
import ArtistList from './ArtistList';
import PlaylistList from './PlaylistList';

export default function TabContent({ activeTab, library, libraryPath }) {
  switch (activeTab) {
    case TABS.HOME:
      return <HomeView library={library} libraryPath={libraryPath} />;
    case TABS.SONGS:
      return <SongList songs={library.songs || []} />;
    case TABS.ALBUMS:
      return <AlbumList albums={library.albums || []} songs={library.songs || []} libraryPath={libraryPath} />;
    case TABS.ARTISTS:
      return <ArtistList artists={library.artists || []} songs={library.songs || []} />;
    case TABS.PLAYLISTS:
      return <PlaylistList playlists={library.playlists || []} songs={library.songs || []} />;
    default:
      return null;
  }
}
