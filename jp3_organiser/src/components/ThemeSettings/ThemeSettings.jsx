import { useEffect, useRef, useState } from 'react';
import {
    loadThemes,
    saveThemes,
    applyTheme,
    getSelectedTheme,
    JP3_ID,
    JP3_COLORS,
} from '../../services/themeService';
import styles from './ThemeSettings.module.css';

const COLOR_FIELDS = [
    { name: '--sketch-bg', label: 'Background' },
    { name: '--secondary', label: 'Secondary' },
    { name: '--tertiary', label: 'Tertiary' },
    { name: '--sketch-text', label: 'Text / borders' },
];

export default function ThemeSettings({ isCollapsed }) {
    const [isOpen, setIsOpen] = useState(false);
    const [settings, setSettings] = useState(null);
    const [newName, setNewName] = useState('');
    const wrapperRef = useRef(null);

    useEffect(() => {
        loadThemes().then(setSettings);
    }, []);

    // Close on click outside or Escape, only while open
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setIsOpen(false);
        };
        const handleEscape = (e) => e.key === 'Escape' && setIsOpen(false);
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const update = (next) => {
        setSettings(next);
        applyTheme(next);
        saveThemes(next);
    };

    const selected = settings && getSelectedTheme(settings);
    const colors = selected?.colors ?? JP3_COLORS;

    const addTheme = (e) => {
        e.preventDefault();
        const name = newName.trim();
        if (!name) return;
        const theme = { id: crypto.randomUUID(), name, colors: { ...colors } };
        update({ selectedId: theme.id, custom: [...settings.custom, theme] });
        setNewName('');
    };

    const deleteTheme = (id) =>
        update({
            selectedId: settings.selectedId === id ? JP3_ID : settings.selectedId,
            custom: settings.custom.filter((theme) => theme.id !== id),
        });

    const setColor = (name, value) =>
        update({
            ...settings,
            custom: settings.custom.map((theme) =>
                theme.id === selected.id ? { ...theme, colors: { ...theme.colors, [name]: value } } : theme
            ),
        });

    return (
        <div className={styles.wrapper} ref={wrapperRef}>
            <button
                className={`${styles.cogBtn} ${isOpen ? styles.cogOpen : ''}`}
                onClick={() => setIsOpen((open) => !open)}
                title="Theme settings"
            >
                <span className={styles.icon}>⚙</span>
                {!isCollapsed && <span className={styles.label}>Theme</span>}
            </button>

            {isOpen && settings && (
                <div className={styles.popup}>
                    <ul className={styles.themeList}>
                        {[{ id: JP3_ID, name: 'JP3' }, ...settings.custom].map(({ id, name }) => (
                            <li key={id} className={styles.themeRow}>
                                <button
                                    className={`${styles.btn} ${styles.themeBtn} ${settings.selectedId === id ? styles.active : ''}`}
                                    onClick={() => update({ ...settings, selectedId: id })}
                                    title={name}
                                >
                                    {name}
                                </button>
                                {id !== JP3_ID && (
                                    <button
                                        className={`${styles.btn} ${styles.deleteBtn}`}
                                        onClick={() => deleteTheme(id)}
                                        title={`Delete ${name}`}
                                    >
                                        ×
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>

                    <form className={styles.themeRow} onSubmit={addTheme}>
                        <input
                            className={styles.nameInput}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            placeholder="New theme name"
                            maxLength={30}
                        />
                        <button
                            type="submit"
                            className={`${styles.btn} ${styles.deleteBtn}`}
                            disabled={!newName.trim()}
                            title="Add theme from current colours"
                        >
                            +
                        </button>
                    </form>

                    {COLOR_FIELDS.map(({ name, label }) => (
                        <label key={name} className={`${styles.colorRow} ${selected ? '' : styles.disabled}`}>
                            {label}
                            <input
                                type="color"
                                value={colors[name]}
                                disabled={!selected}
                                onChange={(e) => setColor(name, e.target.value)}
                            />
                        </label>
                    ))}
                    {!selected && <p className={styles.hint}>JP3 is locked. Press + to make an editable copy.</p>}
                </div>
            )}
        </div>
    );
}
