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

import React, { useState, useRef, useEffect } from 'react';
import { usePlayer } from '../../hooks';
import styles from './QueueDrawer.module.css';
import DraggableHandle from './DraggableHandle';

export default function QueueDrawer({ isOpen, onClose }) {
  // Feature flag: toggle manual reordering affordances
  const ENABLE_MANUAL_REORDER = true;
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
    shuffleUserQueue,
    playTrack,
  } = usePlayer();

  // Drag state for user queue
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragNodeRef = useRef(null);
  const sourceIndexRef = useRef(null);
  const lastDragOverUpdateRef = useRef(0);
  const DRAG_OVER_THROTTLE_MS = 250; // Throttle dragOverIndex updates to reduce re-renders

  // Virtualization state for user queue
  const queueListRef = useRef(null);
  const userQueueRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const ITEM_HEIGHT = 56; // px - approximate per .queueItem
  const OVERSCAN = 6; // items to render above/below viewport

  const handleDragStart = (e, index) => {
    sourceIndexRef.current = index;
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));

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

    sourceIndexRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (sourceIndexRef.current === null) return;

    const now = performance.now();
    if (now - lastDragOverUpdateRef.current >= DRAG_OVER_THROTTLE_MS) {
      if (index !== dragOverIndex) {
        setDragOverIndex(index);
        lastDragOverUpdateRef.current = now;
      }
    }
  };

  const handleDrop = (e, index) => {
    e.preventDefault();

    const sourceIndex = sourceIndexRef.current ?? Number(e.dataTransfer.getData('text/plain'));
    if (sourceIndex === null || Number.isNaN(sourceIndex)) {
      return;
    }

    const targetIndex = index;
    if (sourceIndex !== targetIndex) {
      reorderUserQueue(sourceIndex, targetIndex);
    }

    if (dragNodeRef.current) {
      dragNodeRef.current.classList.remove(styles.dragging);
    }

    sourceIndexRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
    dragNodeRef.current = null;
  };

  const handleDoubleClick = (index) => {
    // Get the track at the specified index in the user queue
    const track = userQueue[index];
    if (track) {
      // Play the track with playTrack (doesn't clear the user queue)
      // Pass a single-track context so it plays this track
      playTrack(track, [track]);
      // Remove it from the queue
      removeFromUserQueue(index);
    }
  };

  useEffect(() => {
    const el = queueListRef.current;
    if (!el) return;

    const onScroll = (ev) => {
      setScrollTop(el.scrollTop);
    };

    const resizeObserver = new ResizeObserver(() => {
      setContainerHeight(el.clientHeight);
    });

    el.addEventListener('scroll', onScroll);
    resizeObserver.observe(el);
    // init
    setScrollTop(el.scrollTop);
    setContainerHeight(el.clientHeight);

    return () => {
      el.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
    };
  }, []);

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

  const handleShuffleUserQueue = () => {
    shuffleUserQueue();
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
      <div className={`${styles.drawer}`}>
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
        <div className={styles.queueList} ref={queueListRef}>
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
                  </div>
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

              {/* User Queue (plays next, before context) */}
              {userQueue.length > 0 && (
                <div className={styles.section} ref={userQueueRef}>
                  <div className={styles.sectionHeader}>
                    <h4 className={styles.sectionTitle}>
                      Next in Queue ({userQueue.length})
                    </h4>
                    <div className={styles.sectionActions}>
                      {userQueue.length > 1 && (
                        <button
                          className={styles.clearSectionBtn}
                          onClick={handleShuffleUserQueue}
                          title="Shuffle queue"
                        >
                          Shuffle
                        </button>
                      )}
                      <button
                        className={styles.clearSectionBtn}
                        onClick={handleClearUserQueue}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Lightweight virtualization: only render visible userQueue items */}
                  {(() => {
                    const list = playingFromUserQueue ? userQueue.slice(1) : userQueue;
                    const userOffsetTop = (() => {
                      try {
                        const listEl = queueListRef.current;
                        const userEl = userQueueRef.current;
                        if (!listEl || !userEl) return 0;
                        return Math.max(0, userEl.offsetTop - listEl.offsetTop);
                      } catch (err) {
                        return 0;
                      }
                    })();

                    const visibleStart = Math.max(0, Math.floor((scrollTop - userOffsetTop) / ITEM_HEIGHT));
                    const startIndex = Math.max(0, visibleStart - OVERSCAN);
                    const visibleCount = Math.min(list.length - startIndex, Math.ceil((containerHeight || 400) / ITEM_HEIGHT) + OVERSCAN * 2);
                    const endIndex = Math.min(list.length, startIndex + Math.max(0, visibleCount));

                    const topSpacerHeight = startIndex * ITEM_HEIGHT;
                    const bottomSpacerHeight = Math.max(0, (list.length - endIndex) * ITEM_HEIGHT);

                    return (
                      <div style={{ position: 'relative' }}>
                        <div style={{ height: topSpacerHeight }} />
                        {list.slice(startIndex, endIndex).map((track, idx) => {
                          const renderedIndex = startIndex + idx;
                          const actualIndex = playingFromUserQueue ? renderedIndex + 1 : renderedIndex;
                          return (
                            <div
                              key={`uq-${track.id}-${actualIndex}`}
                              className={`${styles.queueItem} ${styles.userQueueItem} ${
                                dragOverIndex === actualIndex ? styles.dragOver : ''
                              }`}
                              draggable={ENABLE_MANUAL_REORDER}
                              onDragStart={ENABLE_MANUAL_REORDER ? (e) => handleDragStart(e, actualIndex) : undefined}
                              onDragEnd={ENABLE_MANUAL_REORDER ? handleDragEnd : undefined}
                              onDragOver={ENABLE_MANUAL_REORDER ? (e) => handleDragOver(e, actualIndex) : undefined}
                              onDrop={ENABLE_MANUAL_REORDER ? (e) => handleDrop(e, actualIndex) : undefined}
                              onDoubleClick={() => handleDoubleClick(actualIndex)}
                            >
                              {ENABLE_MANUAL_REORDER && (
                                <DraggableHandle isDragging={dragIndex === actualIndex} />
                              )}
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
                        <div style={{ height: bottomSpacerHeight }} />
                      </div>
                    );
                  })()}
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
