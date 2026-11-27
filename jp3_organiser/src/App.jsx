import { useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import styles from './App.module.css';
import { Navbar, PlayerBar, CommandBar } from './components';
import SplashScreen from './components/SplashScreen';
import About from './pages/About';
import Upload from './pages/Upload';
import View from './pages/View';
import Player from './pages/Player';
import { AlbumDetail, ArtistDetail, PlaylistDetail } from './pages/Player/components/DetailView';
import PlaylistEdit from './pages/PlaylistEdit';
import { useKeyboardShortcut, UploadCacheProvider, PlayerProvider } from './hooks';

function AppLayout({ children, isNavCollapsed }) {
  return (
    <div className={`${styles.appLayout} ${styles.app}`}>
      <Navbar isCollapsed={isNavCollapsed} />
      <main className={`
        ${styles.content} 
        ${isNavCollapsed ? styles.contentCollapsed : ''}
        ${styles.hasPlayerBar}
      `}>
        {children}
      </main>
      <PlayerBar />
      <CommandBar />
    </div>
  );
}

function AppContent({ isNavCollapsed }) {
  return (
    <Routes>
      {/* Splash route - no layout */}
      <Route path="/splash" element={<SplashScreen />} />

      {/* App routes - with layout */}
      <Route
        path="/*"
        element={
          <AppLayout isNavCollapsed={isNavCollapsed}>
            <Routes>
              <Route path="/" element={<Navigate to="/upload" replace />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/view" element={<View />} />
              <Route path="/player" element={<Player />} />
              <Route path="/player/album/:id" element={<AlbumDetail />} />
              <Route path="/player/artist/:id" element={<ArtistDetail />} />
              <Route path="/player/playlist/:id" element={<PlaylistDetail />} />
              <Route path="/playlist/:id" element={<PlaylistEdit />} />
              <Route path="/about" element={<About />} />
            </Routes>
          </AppLayout>
        }
      />
    </Routes>
  );
}

function App() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(true);

  const toggleNav = useCallback(() => {
    setIsNavCollapsed(prev => !prev);
  }, []);

  useKeyboardShortcut('s', toggleNav, { ctrl: true });

  return (
    <UploadCacheProvider>
      <PlayerProvider>
        <AppContent isNavCollapsed={isNavCollapsed} />
      </PlayerProvider>
    </UploadCacheProvider>
  );
}

export default App;
