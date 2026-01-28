import { useEffect, useRef, useState, useCallback } from "react";
import { readFile } from "@tauri-apps/plugin-fs";

export function useAudioEngine({ onEnded, volume = 1 }) {
  const ctxRef = useRef(null);
  const gainRef = useRef(null);
  const sourceRef = useRef(null);
  const bufferRef = useRef(null);
  const endedNaturallyRef = useRef(false);


  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const rafRef = useRef(null);
  const loadVersionRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  /* ---------- Init AudioContext ---------- */
  useEffect(() => {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    ctxRef.current = ctx;
    gainRef.current = gain;

    return () => {
      stop();
      ctx.close();
    };
  }, []);


  /* ENsure only one isntance at a time */
  const stopSource = () => {
  if (sourceRef.current) {
    try {
      sourceRef.current.onended = null;
      sourceRef.current.stop();
      sourceRef.current.disconnect();
    } catch {}
    sourceRef.current = null;
  }
};



  /* ---------- Volume ---------- */
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    }
  }, [volume]);

  /* ---------- RAF position tracking ---------- */
const isPlayingRef = useRef(false);

useEffect(() => {
  isPlayingRef.current = isPlaying;
}, [isPlaying]);

const startPositionTracking = () => {
  // Cancel any existing RAF first
  cancelAnimationFrame(rafRef.current);
  rafRef.current = null;

  const tick = () => {
    // Double-check state before proceeding
    if (!isPlayingRef.current || !ctxRef.current) {
      rafRef.current = null;
      return;
    }

    const ctx = ctxRef.current;
    const pos = ctx.currentTime - startTimeRef.current;

    setPosition(Math.min(pos, duration));
    rafRef.current = requestAnimationFrame(tick);
  };

  rafRef.current = requestAnimationFrame(tick);
};

const stopPositionTracking = () => {
  if (rafRef.current) {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }
};
  /* ---------- Core controls ---------- */
  

const stop = useCallback(() => {
  endedNaturallyRef.current = false;
  stopSource();
  pauseOffsetRef.current = 0;
  setIsPlaying(false);
  stopPositionTracking();
}, []);



 const pause = useCallback(() => {
  if (!isPlaying) return;

  const ctx = ctxRef.current;
  pauseOffsetRef.current = ctx.currentTime - startTimeRef.current;

  endedNaturallyRef.current = false;
  stopSource();

  setIsPlaying(false);
  stopPositionTracking();
}, [isPlaying]);



  const resume = useCallback(() => {
    if (!bufferRef.current || isPlaying) return;

    
    playFromOffset(pauseOffsetRef.current);
  }, [isPlaying]);

const playFromOffset = (offset) => {
  const ctx = ctxRef.current;
  if (!bufferRef.current || !ctx) return;

  // 🔴 STOP ANY EXISTING SOURCE FIRST
  stopSource();
  stopPositionTracking(); // Ensure tracking is stopped before starting new

  const source = ctx.createBufferSource();
  source.buffer = bufferRef.current;
  source.connect(gainRef.current);

  endedNaturallyRef.current = true;

  source.onended = () => {
    if (!endedNaturallyRef.current) return;

    stopPositionTracking();
    setIsPlaying(false);
    pauseOffsetRef.current = 0;
    onEnded?.();
  };

  // Set timing BEFORE starting playback
  startTimeRef.current = ctx.currentTime - offset;
  
  source.start(0, offset);

  sourceRef.current = source;
  setIsPlaying(true);
  
  // Start tracking after state is set
  requestAnimationFrame(() => startPositionTracking());
};



  const seek = useCallback((seconds) => {
  if (!bufferRef.current) return;

  const clamped = Math.max(0, Math.min(seconds, duration));
  pauseOffsetRef.current = clamped;

  if (isPlaying) {
    endedNaturallyRef.current = false; // prevent queue advance
    playFromOffset(clamped);
  } else {
    setPosition(clamped);
  }
}, [isPlaying, duration]);


  /* ---------- Load & play ---------- */

  const loadAndPlay = useCallback(async (filePath) => {
    const version = ++loadVersionRef.current;

    try {
      setError(null);
      setIsLoading(true);
      setIsPlaying(false);

      stop();

      const bytes = await readFile(filePath);
      if (version !== loadVersionRef.current) return;

      const ctx = ctxRef.current;
      const buffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
      if (version !== loadVersionRef.current) return;

      bufferRef.current = buffer;
      setDuration(buffer.duration);
      pauseOffsetRef.current = 0;

      // Ensure audio context is running
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      playFromOffset(0);
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load audio");
      setIsLoading(false);
    }
  }, [stop]);

  return {
    isPlaying,
    isLoading,
    position,
    duration,
    error,
    loadAndPlay,
    pause,
    resume,
    seek,
    stop,
  };
}
