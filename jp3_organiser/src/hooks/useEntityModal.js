import { useState, useCallback } from 'react';

export function useEntityModal() {
  const [item, setItem] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((entity) => {
    setItem(entity);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setItem(null);
    setIsOpen(false);
  }, []);

  return { item, isOpen, open, close, setItem, setIsOpen };
}

export default useEntityModal;
