/**
 * ProgressSlider Component
 * 
 * Displays playback progress with a seekable slider.
 * Shows current time and total duration.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDuration } from '../../utils/formatters';
import styles from './PlayerBar.module.css';

function ProgressSlider({ position, duration, onSeek, disabled }) {
  const THROTTLE_MS = 250; // update displayed time at most every 250ms
  const lastDisplayUpdateRef = useRef(0);
  const timeoutRef = useRef(null);
  const [displayPosition, setDisplayPosition] = useState(position);

  useEffect(() => {
    // Throttle updates to `displayPosition` so the UI doesn't re-render on every position change
    try {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const last = lastDisplayUpdateRef.current || 0;
      const elapsed = now - last;

      if (elapsed >= THROTTLE_MS) {
        setDisplayPosition(position);
        lastDisplayUpdateRef.current = now;
      } else {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setDisplayPosition(position);
          lastDisplayUpdateRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
        }, THROTTLE_MS - elapsed);
      }
    } catch (err) {
      setDisplayPosition(position);
    }

    return () => {
      clearTimeout(timeoutRef.current);
    };
  }, [position]);

  const progress = useMemo(() => (duration > 0 ? (displayPosition / duration) * 100 : 0), [displayPosition, duration]);

  const displayedTime = useMemo(() => formatDuration(displayPosition), [displayPosition]);
  const totalTime = useMemo(() => formatDuration(duration), [duration]);

  const handleChange = useCallback(
    (e) => {
      const pct = parseFloat(e.target.value) / 100;
      const newPosition = Math.max(0, Math.min(pct * duration, duration));
      onSeek(newPosition);
    },
    [duration, onSeek]
  );

  return (
    <div className={styles.progress}>
      <span className={styles.time}>{displayedTime}</span>
      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        value={progress}
        onChange={handleChange}
        disabled={disabled || duration === 0}
        className={styles.slider}
        aria-label="Seek"
        style={{
          '--progress': `${progress}%`
        }}
      />
      <span className={styles.time}>{totalTime}</span>
    </div>
  );
}

export default React.memo(ProgressSlider);
