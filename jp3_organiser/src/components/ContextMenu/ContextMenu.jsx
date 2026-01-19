/**
 * ContextMenu Component
 * 
 * A right-click context menu that appears at mouse position.
 * Closes when clicking outside or pressing Escape.
 * Uses a portal to render at document body level.
 * 
 * @param {Object} props
 * @param {boolean} props.visible - Whether the menu is visible
 * @param {Object} props.position - { x, y } coordinates for menu position
 * @param {Array} props.items - Array of menu items: { label: string, onClick: function, variant?: 'danger' }
 * @param {function} props.onClose - Callback when menu should close
 */

import { useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import styles from './ContextMenu.module.css';

export default function ContextMenu({ visible, position = { x: 0, y: 0 }, items = [], onClose }) {
  const menuRef = useRef(null);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (!visible || !menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Adjust if menu would overflow right edge
    if (position.x + rect.width > viewportWidth) {
      menu.style.left = `${viewportWidth - rect.width - 8}px`;
    }

    // Adjust if menu would overflow bottom edge
    if (position.y + rect.height > viewportHeight) {
      menu.style.top = `${viewportHeight - rect.height - 8}px`;
    }
  }, [visible, position]);

  // Handle outside clicks, escape key, and scroll
  useEffect(() => {
    if (!visible) return;

    // Use a small delay to avoid the same click event closing the menu
    let isListening = false;
    const timer = setTimeout(() => {
      isListening = true;
    }, 0);

    const handleClickOutside = (e) => {
      if (!isListening) return;
      const isInsideMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!isInsideMenu) {
        onClose?.();
      }
    };

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    const handleScroll = () => {
      onClose?.();
    };

    // Also close on right-click elsewhere
    const handleContextMenu = (e) => {
      if (!isListening) return;
      const isInsideMenu = menuRef.current && menuRef.current.contains(e.target);
      if (!isInsideMenu) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [visible, onClose]);

  const handleItemClick = useCallback((e, onClick) => {
    e.stopPropagation();
    onClose?.();
    onClick?.();
  }, [onClose]);

  if (!visible || !items.length) return null;

  return createPortal(
    <div 
      ref={menuRef}
      className={styles.contextMenu}
      style={{ top: position.y, left: position.x }}
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
  );
}
