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

export default React.memo(function TabContent({ 
  activeTab, 
  library, 
  libraryPath, 
  onDeleteSong, 
  onEditSong,
  onDeleteAlbum,
  onEditAlbum,
  onDeleteArtist,
  onEditArtist,
}) {
  const Component = tabComponents[activeTab];
  
  if (!Component) {
    return null;
  }

  if (activeTab === TABS.PLAYLISTS) {
    return <Component library={library} libraryPath={libraryPath} />;
  }

  if (activeTab === TABS.SONGS) {
    return <Component library={library} onDeleteSong={onDeleteSong} onEditSong={onEditSong} />;
  }

  if (activeTab === TABS.ALBUMS) {
    return <Component library={library} onDeleteAlbum={onDeleteAlbum} onEditAlbum={onEditAlbum} />;
  }

  if (activeTab === TABS.ARTISTS) {
    return <Component library={library} onDeleteArtist={onDeleteArtist} onEditArtist={onEditArtist} />;
  }

  return <Component library={library} />;
});
