import { useEffect, useRef } from 'react';

/**
 * Hook to handle keyboard shortcuts
 * @param {string} key - The key to listen for
 * @param {Function} callback - Function to call when key combo is pressed
 * @param {Object} options - Modifier keys (ctrl, shift, alt, meta)
 */
export function useKeyboardShortcut(key, callback, { ctrl = false, shift = false, alt = false, meta = false } = {}) {
    const callbackRef = useRef(callback);

    // Keep callback ref current without triggering effect re-runs
    useEffect(() => {
        callbackRef.current = callback;
    });

    useEffect(() => {
        const handleKeyDown = (e) => {
            const keyMatch = e.key.toLowerCase() === key.toLowerCase();
            const ctrlMatch = ctrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey);
            const shiftMatch = e.shiftKey === shift;
            const altMatch = e.altKey === alt;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                e.preventDefault();
                e.stopPropagation();
                callbackRef.current();
            }
        };

        // Use capture phase to intercept before other handlers
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [key, ctrl, shift, alt, meta]);
}
