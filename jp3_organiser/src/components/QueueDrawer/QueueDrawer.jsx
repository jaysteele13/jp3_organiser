/**
 * QueueDrawer Component
 * 
 * Slide-out drawer panel displaying the current playback queue.
 * Shows two sections:
 * - "Now Playing" / "Up Next" from context (album/playlist you're playing from)
 * - "Queue" for user-added songs (consumed when played)
 * 
 * Features:
 * - Current track highlighting
 * - Remove tracks from user queue
 * - Drag-to-reorder user queue tracks
 * - Clear user queue
 * - Click context tracks to jump to them
 */

import React, { useState, useRef } from 'react';
import { usePlayer } from '../../hooks';
import styles from './QueueDrawer.module.css';

export default function QueueDrawer({ isOpen, onClose }) {
  const {
    displayQueue,
    context,
    contextIndex,
    userQueue,
    playingFromUserQueue,
    currentTrack,
    skipToIndex,
    removeFromUserQueue,
    reorderUserQueue,
    clearUserQueue,
    clearQueue,
  } = usePlayer();

  // Drag state for user queue
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragNodeRef = useRef(null);

  const handleDragStart = (e, index) => {
    setDragIndex(index);
    dragNodeRef.current = e.target;
    e.dataTransfer.effectAllowed = 'move';
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
    
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      reorderUserQueue(dragIndex, dragOverIndex);
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

  const handleContextTrackClick = (index) => {
    skipToIndex(index);
  };

  const handleUserQueueRemove = (e, index) => {
    e.stopPropagation();
    removeFromUserQueue(index);
  };

  const handleClearUserQueue = () => {
    clearUserQueue();
  };

  const handleClearAll = () => {
    clearQueue();
  };

  if (!isOpen) return null;

  // Get remaining context tracks (after current)
  const upNextContext = contextIndex >= 0 
    ? context.slice(contextIndex + 1) 
    : [];

  const hasContent = currentTrack || upNextContext.length > 0 || userQueue.length > 0;

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
            {hasContent && (
              <button 
                className={styles.clearBtn}
                onClick={handleClearAll}
              >
                Clear All
              </button>
            )}
            <button className={styles.closeBtn} onClick={onClose}>
              X
            </button>
          </div>
        </div>

        {/* Queue Content */}
        <div className={styles.queueList}>
          {!hasContent ? (
            <div className={styles.empty}>
              Queue is empty. Play a song from the Player page.
            </div>
          ) : (
            <>
              {/* Now Playing */}
              {currentTrack && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>Now Playing</h4>
                  <div className={`${styles.queueItem} ${styles.current}`}>
                    <span className={styles.trackNumber}>{'>'}</span>
                    <div className={styles.trackInfo}>
                      <span className={styles.trackTitle}>{currentTrack.title}</span>
                      <span className={styles.trackArtist}>{currentTrack.artistName}</span>
                    </div>
                    {playingFromUserQueue && (
                      <span className={styles.queueBadge}>Queue</span>
                    )}
                  </div>
                </div>
              )}

              {/* User Queue (plays next, before context) */}
              {userQueue.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <h4 className={styles.sectionTitle}>
                      Next in Queue ({userQueue.length})
                    </h4>
                    <button 
                      className={styles.clearSectionBtn}
                      onClick={handleClearUserQueue}
                    >
                      Clear
                    </button>
                  </div>
                  {(playingFromUserQueue ? userQueue.slice(1) : userQueue).map((track, index) => {
                    // Adjust index for display when playing from user queue
                    const actualIndex = playingFromUserQueue ? index + 1 : index;
                    return (
                      <div
                        key={`uq-${track.id}-${actualIndex}`}
                        className={`${styles.queueItem} ${styles.userQueueItem} ${
                          dragOverIndex === actualIndex ? styles.dragOver : ''
                        }`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, actualIndex)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, actualIndex)}
                      >
                        <span className={styles.dragHandle}>☰</span>
                        <span className={styles.trackNumber}>{actualIndex + 1}</span>
                        <div className={styles.trackInfo}>
                          <span className={styles.trackTitle}>{track.title}</span>
                          <span className={styles.trackArtist}>{track.artistName}</span>
                        </div>
                        <button
                          className={styles.removeBtn}
                          onClick={(e) => handleUserQueueRemove(e, actualIndex)}
                          title="Remove from queue"
                        >
                          x
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Up Next from Context */}
              {upNextContext.length > 0 && (
                <div className={styles.section}>
                  <h4 className={styles.sectionTitle}>
                    Up Next ({upNextContext.length})
                  </h4>
                  {upNextContext.map((track, index) => {
                    const actualContextIndex = contextIndex + 1 + index;
                    return (
                      <div
                        key={`ctx-${track.id}-${actualContextIndex}`}
                        className={styles.queueItem}
                        onClick={() => handleContextTrackClick(actualContextIndex)}
                      >
                        <span className={styles.trackNumber}>{index + 1}</span>
                        <div className={styles.trackInfo}>
                          <span className={styles.trackTitle}>{track.title}</span>
                          <span className={styles.trackArtist}>{track.artistName}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {hasContent && (
          <div className={styles.footer}>
            {userQueue.length > 0 && (
              <span>{userQueue.length} in queue</span>
            )}
            {userQueue.length > 0 && upNextContext.length > 0 && ' • '}
            {upNextContext.length > 0 && (
              <span>{upNextContext.length} up next</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
