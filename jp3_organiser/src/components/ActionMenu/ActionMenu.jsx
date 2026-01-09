/**
 * ActionMenu Component
 * 
 * A kebab menu (...) that reveals action items in a dropdown.
 * Closes when clicking outside or pressing Escape.
 * Uses a portal to render dropdown at document body level to escape
 * any parent transforms that would break fixed positioning.
 * 
 * @param {Object} props
 * @param {Array} props.items - Array of action items: { label: string, onClick: function, variant?: 'danger' }
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './ActionMenu.module.css';

export default function ActionMenu({ items = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.right - 120, // Align right edge (120px is min-width)
    });
  }, [isOpen]);

  // Handle outside clicks, escape key, and scroll - with delay to avoid same-event closure
  useEffect(() => {
    if (!isOpen) return;

    // Use a small delay to avoid the same click event closing the menu
    let isListening = false;
    const timer = setTimeout(() => {
      isListening = true;
    }, 0);

    const handleClickOutside = (e) => {
      if (!isListening) return;
      // Check both the menu container and the portal dropdown
      const isInsideMenu = menuRef.current && menuRef.current.contains(e.target);
      const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!isInsideMenu && !isInsideDropdown) {
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
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const handleToggle = useCallback((e) => {
    e.stopPropagation();
    setIsOpen(prev => !prev);
  }, []);

  const handleItemClick = useCallback((e, onClick) => {
    e.stopPropagation();
    setIsOpen(false);
    onClick?.();
  }, []);

  if (!items.length) return null;

  return (
    <div className={styles.menuContainer} ref={menuRef}>
      <button 
        ref={buttonRef}
        className={styles.menuButton}
        onClick={handleToggle}
        title="Actions"
        aria-label="Actions menu"
        aria-expanded={isOpen}
      >
        ...
      </button>
      
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className={styles.dropdown}
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {items.map((item, index) => (
            <button 
              key={index}
              className={`${styles.menuItem} ${item.variant === 'danger' ? styles.dangerItem : ''}`}
              onClick={(e) => handleItemClick(e, item.onClick)}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
