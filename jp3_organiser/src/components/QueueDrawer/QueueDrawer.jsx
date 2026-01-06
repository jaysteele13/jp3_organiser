/**
 * QueueDrawer Component
 * 
 * Slide-out drawer panel displaying the current playback queue.
 * Features:
 * - View all tracks in queue
 * - Current track highlighting
 * - Remove tracks from queue
 * - Drag-to-reorder tracks
 * - Clear entire queue
 */

import React, { useState, useRef } from 'react';
import { usePlayer } from '../../hooks';
import styles from './QueueDrawer.module.css';

export default function QueueDrawer({ isOpen, onClose }) {
  const {
    queue,
    currentIndex,
    skipToIndex,
    removeFromQueue,
    reorderQueue,
    clearQueue,
  } = usePlayer();

  // Drag state
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragNodeRef = useRef(null);

  const handleDragStart = (e, index) => {
    setDragIndex(index);
    dragNodeRef.current = e.target;
    e.dataTransfer.effectAllowed = 'move';
    // Make drag image semi-transparent
    setTimeout(() => {
      if (dragNodeRef.current) {
        dragNodeRef.current.classList.add(styles.dragging);
      }
    }, 0);
  };

  const handleDragEnd = () => {
    if (dragNodeRef.current) {
      dragNodeRef.current.classList.remove(styles.dragging);
    }
    
    // Perform reorder if valid
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      reorderQueue(dragIndex, dragOverIndex);
    }
    
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (dragIndex === null) return;
    if (index !== dragOverIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    // Only clear if leaving the list entirely
  };

  const handleTrackClick = (index) => {
    skipToIndex(index);
  };

  const handleRemove = (e, index) => {
    e.stopPropagation();
    removeFromQueue(index);
  };

  const handleClearQueue = () => {
    clearQueue();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className={styles.backdrop} onClick={onClose} />
      
      {/* Drawer */}
      <div className={styles.drawer}>
        {/* Header */}
        <div className={styles.header}>
          <h3 className={styles.title}>Queue</h3>
          <div className={styles.headerActions}>
            {queue.length > 0 && (
              <button 
                className={styles.clearBtn}
                onClick={handleClearQueue}
              >
                Clear
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>
              X
            </button>
          </div>
        </div>

        {/* Queue List */}
        <div className={styles.queueList}>
          {queue.length === 0 ? (
            <div className={styles.empty}>
              Queue is empty. Add songs from the Player page.
            </div>
          ) : (
            queue.map((track, index) => (
              <div
                key={`${track.id}-${index}`}
                className={`${styles.queueItem} ${
                  index === currentIndex ? styles.current : ''
                } ${dragOverIndex === index ? styles.dragOver : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onClick={() => handleTrackClick(index)}
              >
                {/* Drag Handle */}
                <span className={styles.dragHandle}>
                  :::
                </span>
                
                {/* Track Number */}
                <span className={styles.trackNumber}>
                  {index === currentIndex ? '>' : index + 1}
                </span>
                
                {/* Track Info */}
                <div className={styles.trackInfo}>
                  <span className={styles.trackTitle}>{track.title}</span>
                  <span className={styles.trackArtist}>{track.artistName}</span>
                </div>
                
                {/* Remove Button */}
                <button
                  className={styles.removeBtn}
                  onClick={(e) => handleRemove(e, index)}
                  title="Remove from queue"
                >
                  x
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {queue.length > 0 && (
          <div className={styles.footer}>
            {queue.length} track{queue.length !== 1 ? 's' : ''} in queue
          </div>
        )}
      </div>
    </>
  );
}
