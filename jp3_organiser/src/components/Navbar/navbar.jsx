import { NavLink } from 'react-router-dom';
import styles from './navbar.module.css';
import ThemeSettings from '../ThemeSettings';

const NAV_ITEMS = [
    { to: '/upload', label: 'Upload', icon: '↑' },
    { to: '/view', label: 'View', icon: '♫' },
    { to: '/player', label: 'Player', icon: '▶' },
    { to: '/about', label: 'About', icon: '?' },
];

export default function Navbar({ isCollapsed }) {
    return (
        <nav className={`${styles.navbar} ${isCollapsed ? styles.collapsed : ''}`}>
            <div className={styles.header}>
                <div className={styles.logo}>
                    {isCollapsed ? 'JP3' : 'JP3 Organiser'}
                </div>
            </div>

            <div className={styles.navLinks}>
                {NAV_ITEMS.map(({ to, label, icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `${styles.navLink} ${isActive ? styles.active : ''}`
                        }
                    >
                        <span className={styles.icon}>{icon}</span>
                        {!isCollapsed && <span className={styles.label}>{label}</span>}
                    </NavLink>
                ))}
            </div>

            <div className={styles.footer}>
                <ThemeSettings isCollapsed={isCollapsed} />
            </div>
        </nav>
    );
}
