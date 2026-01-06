import { useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import styles from './App.module.css';
import { Navbar, PlayerBar } from './components';
import About from './pages/About';
import Upload from './pages/Upload';
import View from './pages/View';
import Player from './pages/Player';
import PlaylistEdit from './pages/PlaylistEdit';
import { useKeyboardShortcut, UploadCacheProvider, PlayerProvider, usePlayer } from './hooks';

/**
 * AppContent - Inner component that uses player context
 * 
 * Separated to access usePlayer hook for conditional styling.
 */
function AppContent({ isNavCollapsed, onToggle }) {
  const { currentTrack } = usePlayer();
  const hasPlayer = currentTrack !== null;

  return (
    <div className={styles.appLayout}>
      <Navbar isCollapsed={isNavCollapsed} onToggle={onToggle} />
      <main className={`
        ${styles.content} 
        ${isNavCollapsed ? styles.contentCollapsed : ''}
        ${hasPlayer ? styles.hasPlayerBar : ''}
      `}>
        <Routes>
          <Route path="/" element={<Navigate to="/upload" replace />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/view" element={<View />} />
          <Route path="/player" element={<Player />} />
          <Route path="/playlist/:id" element={<PlaylistEdit />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
      <PlayerBar />
    </div>
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
        <AppContent isNavCollapsed={isNavCollapsed} onToggle={toggleNav} />
      </PlayerProvider>
    </UploadCacheProvider>
  );
}

export default App;
