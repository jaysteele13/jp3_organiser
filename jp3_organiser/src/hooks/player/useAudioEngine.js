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
  cancelAnimationFrame(rafRef.current);

  const tick = () => {
    if (!isPlayingRef.current) return;

    const ctx = ctxRef.current;
    const pos = ctx.currentTime - startTimeRef.current;

    setPosition(Math.min(pos, duration));
    rafRef.current = requestAnimationFrame(tick);
  };

  rafRef.current = requestAnimationFrame(tick);
};

const stopPositionTracking = () => {
  cancelAnimationFrame(rafRef.current);
};
  /* ---------- Core controls ---------- */
  

  const stop = useCallback(() => {
  if (sourceRef.current) {
    endedNaturallyRef.current = false;
    sourceRef.current.stop();
    sourceRef.current = null;
  }
  pauseOffsetRef.current = 0;
  setIsPlaying(false);
  stopPositionTracking();
}, []);


  const pause = useCallback(() => {
  if (!isPlaying || !sourceRef.current) return;

  const ctx = ctxRef.current;
  pauseOffsetRef.current = ctx.currentTime - startTimeRef.current;

  endedNaturallyRef.current = false;
  sourceRef.current.stop();
  sourceRef.current = null;

  setIsPlaying(false);
  stopPositionTracking();
}, [isPlaying]);


  const resume = useCallback(() => {
    if (!bufferRef.current || isPlaying) return;
    playFromOffset(pauseOffsetRef.current);
  }, [isPlaying]);

    const playFromOffset = (offset) => {
    const ctx = ctxRef.current;

    const source = ctx.createBufferSource();
    source.buffer = bufferRef.current;


    source.connect(gainRef.current);

    // Mark this playback as a "real" play
    endedNaturallyRef.current = true;

    source.onended = () => {
        stopPositionTracking();
        setIsPlaying(false);

        // Only advance queue if this ended naturally
        if (endedNaturallyRef.current) {
        endedNaturallyRef.current = false;
        pauseOffsetRef.current = 0;
        onEnded?.();
        }
    };

    source.start(0, offset);

    sourceRef.current = source;
    startTimeRef.current = ctx.currentTime - offset;
    setIsPlaying(true);
    startPositionTracking();
    };


  const seek = useCallback((seconds) => {
    if (!bufferRef.current) return;
    pauseOffsetRef.current = Math.max(0, Math.min(seconds, duration));
    if (isPlaying) {
      stop();
      playFromOffset(pauseOffsetRef.current);
    } else {
      setPosition(pauseOffsetRef.current);
    }
  }, [isPlaying, duration, stop]);

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
