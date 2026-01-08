import React from 'react';
import { TABS } from '../../../../utils/enums';
import SongView from '../Tabs/Songs';
import AlbumView from '../Tabs/Albums';
import ArtistView from '../Tabs/Artists';
import PlaylistView from '../Tabs/Playlists';

const tabComponents = {
  [TABS.SONGS]: SongView,
  [TABS.ALBUMS]: AlbumView,
  [TABS.ARTISTS]: ArtistView,
  [TABS.PLAYLISTS]: PlaylistView,
};

export default React.memo(function TabContent({ activeTab, library, libraryPath, onDeleteSong, onEditSong }) {
  const Component = tabComponents[activeTab];
  
  if (!Component) {
    return null;
  }

  if (activeTab === TABS.PLAYLISTS) {
    return <Component library={library} libraryPath={libraryPath} />;
  }

  // Pass onDeleteSong and onEditSong to SongView
  if (activeTab === TABS.SONGS) {
    return <Component library={library} onDeleteSong={onDeleteSong} onEditSong={onEditSong} />;
  }

  return <Component library={library} />;
});
