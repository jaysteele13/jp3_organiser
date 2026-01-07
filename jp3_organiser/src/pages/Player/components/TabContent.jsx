/**
 * TabContent Component
 * 
 * Renders the appropriate content based on the active tab.
 * 
 * Props:
 * - activeTab: string - current active tab from TABS enum
 * - library: object - library data
 */

import React from 'react';
import { TABS } from '../../../utils/enums';
import { HomeView } from './Home';
import SongList from './SongList';
import AlbumList from './AlbumList';
import ArtistList from './ArtistList';
import PlaylistList from './PlaylistList';

export default function TabContent({ activeTab, library }) {
  switch (activeTab) {
    case TABS.HOME:
      return <HomeView library={library} />;
    case TABS.SONGS:
      return <SongList songs={library.songs || []} />;
    case TABS.ALBUMS:
      return <AlbumList albums={library.albums || []} songs={library.songs || []} />;
    case TABS.ARTISTS:
      return <ArtistList artists={library.artists || []} songs={library.songs || []} />;
    case TABS.PLAYLISTS:
      return <PlaylistList playlists={library.playlists || []} songs={library.songs || []} />;
    default:
      return null;
  }
}
