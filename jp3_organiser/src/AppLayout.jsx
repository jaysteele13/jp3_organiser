
import styles from './App.module.css';
import { Navbar, PlayerBar } from './components';

export default function AppLayout({ children, isNavCollapsed, onToggle }) {
  return (
    <div className={`${styles.appLayout} ${styles.app}`}>
      <Navbar isCollapsed={isNavCollapsed} onToggle={onToggle} />
      <main className={`
        ${styles.content}
        ${isNavCollapsed ? styles.contentCollapsed : ''}
        ${styles.hasPlayerBar}
      `}>
        {children}
      </main>
      <PlayerBar />
    </div>
  );
}
