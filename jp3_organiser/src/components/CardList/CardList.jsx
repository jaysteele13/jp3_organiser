/**
 * CardList Component
 * 
 * A reusable full-width card list for displaying entities (albums, etc.)
 * Each card has a clickable title, optional subtitle, action menu, and meta info.
 * Optionally supports a thumbnail on the left side.
 * 
 * @param {Object} props
 * @param {Array} props.items - Array of items to display
 * @param {Function} props.getTitle - Function to get title from item
 * @param {Function} props.getSubtitle - Optional function to get subtitle from item
 * @param {Function} props.getMeta - Function to get meta info array from item (e.g., ['2023', '5 songs'])
 * @param {Function} props.onTitleClick - Callback when title is clicked, receives item
 * @param {Function} props.onSubtitleClick - Optional callback when subtitle is clicked, receives (item, event)
 * @param {Function} props.getActions - Function to get action menu items array from item
 * @param {Function} props.renderThumbnail - Optional function to render thumbnail for item
 * @param {string} props.emptyMessage - Message to show when list is empty
 */

import React, { memo, useState, useEffect, useRef } from 'react';
import { ActionMenu } from '../../components';
import styles from './CardList.module.css';

const CardListItem = memo(function CardListItem({
  item,
  title,
  subtitle,
  meta,
  onTitleClick,
  onSubtitleClick,
  actions,
  thumbnail,
}) {
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);
  const [isSubtitleOverflowing, setIsSubtitleOverflowing] = useState(false);
  const titleRef = useRef(null);
  const titleContainerRef = useRef(null);
  const subtitleRef = useRef(null);
  const subtitleContainerRef = useRef(null);

  // Check if title/subtitle overflow their containers
  useEffect(() => {
    const checkOverflow = () => {
      if (titleRef.current && titleContainerRef.current) {
        const textWidth = titleRef.current.scrollWidth;
        const containerWidth = titleContainerRef.current.clientWidth;
        setIsTitleOverflowing(textWidth > containerWidth);
      }
      if (subtitleRef.current && subtitleContainerRef.current) {
        const textWidth = subtitleRef.current.scrollWidth;
        const containerWidth = subtitleContainerRef.current.clientWidth;
        setIsSubtitleOverflowing(textWidth > containerWidth);
      }
    };
    
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [title, subtitle]);

  const handleTitleClick = () => onTitleClick?.(item);
  const handleTitleKeyDown = (e) => e.key === 'Enter' && onTitleClick?.(item);
  const handleSubtitleClick = (e) => {
    e.stopPropagation();
    onSubtitleClick?.(item, e);
  };
  const handleSubtitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      onSubtitleClick?.(item, e);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardContent}>
        {thumbnail && <div className={styles.thumbnail}>{thumbnail}</div>}
        <div className={styles.cardMain}>
          <div className={styles.cardHeader}>
            <div className={styles.cardInfo}>
              <div 
                className={`${styles.scrollContainer} ${isTitleOverflowing ? styles.canScroll : ''}`}
                ref={titleContainerRef}
              >
                <span
                  className={styles.cardTitleLink}
                  onClick={handleTitleClick}
                  onKeyDown={handleTitleKeyDown}
                  role="link"
                  tabIndex={0}
                  ref={titleRef}
                >
                  {title}
                </span>
              </div>
              {subtitle && (
                <div 
                  className={`${styles.scrollContainer} ${isSubtitleOverflowing ? styles.canScroll : ''}`}
                  ref={subtitleContainerRef}
                >
                  <span
                    className={styles.cardSubtitleLink}
                    onClick={handleSubtitleClick}
                    onKeyDown={handleSubtitleKeyDown}
                    role="link"
                    tabIndex={0}
                    ref={subtitleRef}
                  >
                    {subtitle}
                  </span>
                </div>
              )}
            </div>
            {actions && <ActionMenu items={actions} />}
          </div>
          {meta && meta.length > 0 && (
            <div className={styles.cardMeta}>
              {meta.map((item, index) => (
                <span key={index}>{item}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default function CardList({
  items = [],
  getTitle,
  getSubtitle,
  getMeta,
  onTitleClick,
  onSubtitleClick,
  getActions,
  renderThumbnail,
  emptyMessage = 'No items',
}) {
  if (items.length === 0) {
    return <div className={styles.emptyState}>{emptyMessage}</div>;
  }

  return (
    <div className={styles.cardList}>
      {items.map((item) => (
        <CardListItem
          key={item.id}
          item={item}
          title={getTitle(item)}
          subtitle={getSubtitle?.(item)}
          meta={getMeta?.(item)}
          onTitleClick={onTitleClick}
          onSubtitleClick={onSubtitleClick}
          actions={getActions?.(item)}
          thumbnail={renderThumbnail?.(item)}
        />
      ))}
    </div>
  );
}
