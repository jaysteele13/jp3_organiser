import { useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import styles from './App.module.css';
import Navbar from './components/Navbar';
import About from './pages/About';
import Upload from './pages/Upload';
import { useKeyboardShortcut } from './hooks/useKeyboardShortcut';

function App() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);

  const toggleNav = useCallback(() => {
    setIsNavCollapsed(prev => !prev);
  }, []);

  useKeyboardShortcut('s', toggleNav, { ctrl: true });

  return (
    <div className={styles.appLayout}>
      <Navbar isCollapsed={isNavCollapsed} onToggle={toggleNav} />
      <main className={`${styles.content} ${isNavCollapsed ? styles.contentCollapsed : ''}`}>
        <Routes>
          <Route path="/" element={<Navigate to="/upload" replace />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
