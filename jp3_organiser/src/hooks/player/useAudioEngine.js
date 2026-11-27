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
  const lastPosUpdateRef = useRef(0);
  const POSITION_UPDATE_MS = 100; // emit position updates at most every 100ms
  const loadVersionRef = useRef(0);
  const mountedRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(null);

  // Read volume from a ref so contexts created later get the current volume,
  // not the one captured when the callbacks below were first created.
  const volumeRef = useRef(volume);

  const closeAudioContext = () => {
    const old = ctxRef.current;
    ctxRef.current = null;
    gainRef.current = null;
    if (old && old.state !== "closed") {
      old.close().catch((err) => {
        console.warn("Failed to close AudioContext", err);
      });
    }
  };

  // Replaces any existing context. A long-lived context can stay "running"
  // while detached from the speakers (sleep, device change, long idle), so
  // loadAndPlay and resume start from a fresh one.
  const createAudioContext = () => {
    closeAudioContext();
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    try {
      gain.gain.value = volumeRef.current;
    } catch (err) {
      console.warn("Failed to set initial gain value", err);
    }
    ctxRef.current = ctx;
    gainRef.current = gain;
    return ctx;
  };

  const resetAudio = useCallback(() => {
    endedNaturallyRef.current = false;

    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch (err) {
        console.warn("AudioEngine resetAudio failed", err);
      }
      sourceRef.current = null;
    }

    pauseOffsetRef.current = 0;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      resetAudio();
      closeAudioContext();
    };
  }, [resetAudio]);

  useEffect(() => {
    volumeRef.current = volume;
    if (gainRef.current) {
      gainRef.current.gain.value = volume;
    }
  }, [volume]);

  const isPlayingRef = useRef(false);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // The ended handler is attached when a song starts, so read the latest
  // onEnded from a ref to see queue changes made while the song was playing.
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  const startPositionTracking = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const tick = () => {
      if (!isPlayingRef.current || !ctxRef.current) {
        rafRef.current = null;
        return;
      }

      const ctx = ctxRef.current;
      const pos = ctx.currentTime - startTimeRef.current;
      const currentDuration = bufferRef.current?.duration || duration;
      const newPos = Math.min(pos, currentDuration);

      if (mountedRef.current) {
        // Throttle position updates to reduce React renders and CPU usage.
        // Update at most once per POSITION_UPDATE_MS interval.
        try {
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          if (now - lastPosUpdateRef.current >= POSITION_UPDATE_MS) {
            setPosition(newPos);
            lastPosUpdateRef.current = now;
          }
        } catch (err) {
          // Fallback: ensure we still update if performance API throws
          setPosition(newPos);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [duration]);

  const stopPositionTracking = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isPlaying) {
      startPositionTracking();
    } else {
      stopPositionTracking();
    }

    return () => {
      stopPositionTracking();
    };
  }, [isPlaying, startPositionTracking, stopPositionTracking]);

  const stop = useCallback(() => {
    resetAudio();
    if (mountedRef.current) {
      setPosition(0);
      setIsPlaying(false);
    }
  }, [resetAudio]);

  const pause = useCallback(() => {
    if (!isPlaying) return;

    const ctx = ctxRef.current;
    if (!ctx) return;

    pauseOffsetRef.current = ctx.currentTime - startTimeRef.current;
    endedNaturallyRef.current = false;

    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      } catch (err) {
        console.warn("AudioEngine pause failed", err);
      }
      sourceRef.current = null;
    }

    if (mountedRef.current) {
      setPosition(pauseOffsetRef.current);
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const ensureAudioContext = useCallback(async () => {
    let ctx = ctxRef.current;
    if (!ctx || ctx.state === "closed") {
      console.warn("Recreating AudioContext because it was missing or closed");
      ctx = createAudioContext();
    }

    if (ctx.state === "suspended") {
      console.warn("AudioContext is suspended, attempting resume");
      try {
        await ctx.resume();
      } catch (err) {
        console.error("Failed to resume AudioContext", err);
        throw err;
      }
      if (ctx.state !== "running") {
        console.error("AudioContext still not running after resume", ctx.state);
      }
    }

    return ctx;
  }, []);

  const playFromOffset = useCallback(
    async (offset) => {
      if (!bufferRef.current) {
        console.error("playFromOffset failed: no decoded buffer available");
        return;
      }

      const ctx = await ensureAudioContext();
      if (!ctx) {
        console.error("playFromOffset failed: no audio context available");
        return;
      }

      if (ctx.state !== "running") {
        console.warn("playFromOffset called with AudioContext state", ctx.state);
      }

      resetAudio();

      const source = ctx.createBufferSource();
      source.buffer = bufferRef.current;
      source.connect(gainRef.current);

      endedNaturallyRef.current = true;
      source.onended = () => {
        if (!endedNaturallyRef.current) return;
        stopPositionTracking();
        if (mountedRef.current) {
          // Position tracking stops when the window is hidden, so mark the end here.
          setPosition(source.buffer.duration);
          setIsPlaying(false);
        }
        pauseOffsetRef.current = 0;
        onEndedRef.current?.();
      };

      startTimeRef.current = ctx.currentTime - offset;
      if (mountedRef.current) {
        setPosition(offset);
        setIsPlaying(true);
      }

      try {
        source.start(0, offset);
      } catch (err) {
        console.error("AudioBufferSourceNode.start failed", err);
        source.onended = null;
        source.disconnect?.();
        return;
      }

      sourceRef.current = source;
    },
    [ensureAudioContext, resetAudio, stopPositionTracking]
  );

  const resume = useCallback(
    async () => {
      if (!bufferRef.current || isPlaying) return;
      createAudioContext();
      await playFromOffset(pauseOffsetRef.current);
    },
    [isPlaying, playFromOffset]
  );

  const seek = useCallback(
    async (seconds) => {
      if (!bufferRef.current) return;

      const clamped = Math.max(0, Math.min(seconds, duration));
      pauseOffsetRef.current = clamped;

      if (isPlaying) {
        endedNaturallyRef.current = false;
        await playFromOffset(clamped);
      } else if (mountedRef.current) {
        setPosition(clamped);
      }
    },
    [duration, isPlaying, playFromOffset]
  );

  const loadAndPlay = useCallback(
    async (filePath) => {
      const version = ++loadVersionRef.current;

      try {
        if (mountedRef.current) {
          setError(null);
          setIsLoading(true);
          setIsPlaying(false);
        }

        stop();

        const bytes = await readFile(filePath);
        if (version !== loadVersionRef.current) return;

        const ctx = createAudioContext();

        const buffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
        if (version !== loadVersionRef.current) return;

        bufferRef.current = buffer;
        const bufferDuration = buffer.duration;

        if (mountedRef.current) {
          setDuration(bufferDuration);
          setPosition(0);
        }

        pauseOffsetRef.current = 0;
        await playFromOffset(0);
        if (version !== loadVersionRef.current) return;

        if (mountedRef.current) {
          setIsLoading(false);
        }
      } catch (err) {
        // A newer load closed this load's context; its failure is not an error.
        if (version !== loadVersionRef.current) return;
        console.error("loadAndPlay error:", err);
        if (mountedRef.current) {
          setError(err.message || "Failed to load audio");
          setIsLoading(false);
        }
      }
    },
    [playFromOffset, stop]
  );

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
