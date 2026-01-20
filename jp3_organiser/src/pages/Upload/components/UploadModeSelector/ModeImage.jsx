import { useState, useEffect } from 'react';

export default function ModeImage({ still, gif, alt, className, preload = true, playing: playingProp = false }) {
  useEffect(() => {
    if (preload && gif) {
      const img = new Image();
      img.src = gif;
    }
  }, [gif, preload]);

  const prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const shouldPlay = playingProp && !prefersReducedMotion;

  return (
    <img
      src={shouldPlay ? gif : still}
      alt={alt}
      className={className}
      draggable={false}
    />
  );
}
