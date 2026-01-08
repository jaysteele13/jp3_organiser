/**
 * ActionMenu Component
 * 
 * A kebab menu (...) that reveals Edit and Delete actions in a dropdown.
 * Closes when clicking outside or pressing Escape.
 */

import { useState, useRef, useEffect } from 'react';
import styles from './ActionMenu.module.css';

export default function ActionMenu({ onEdit, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  // Calculate dropdown position and handle outside clicks
  useEffect(() => {
    if (!isOpen) return;

    // Position the dropdown relative to the button
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.right - 100, // Align right edge (100px is min-width)
      });
    }

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    onEdit();
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    onDelete();
  };

  return (
    <div className={styles.menuContainer} ref={menuRef}>
      <button 
        ref={buttonRef}
        className={styles.menuButton}
        onClick={handleToggle}
        title="Actions"
        aria-label="Song actions"
        aria-expanded={isOpen}
      >
        ...
      </button>
      
      {isOpen && (
        <div 
          className={styles.dropdown}
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          <button 
            className={styles.menuItem}
            onClick={handleEdit}
          >
            Edit
          </button>
          <button 
            className={`${styles.menuItem} ${styles.deleteItem}`}
            onClick={handleDelete}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
