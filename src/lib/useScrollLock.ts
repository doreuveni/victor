import { useEffect } from 'react';

// Freezes body scroll while a bottom-sheet/modal is open, so the feed behind
// it can't be dragged on iOS ("double scroll").
export function useScrollLock() {
  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
}
