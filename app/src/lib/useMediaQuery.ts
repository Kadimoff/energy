import { useSyncExternalStore } from 'react';

/** Reactive media query (false on the server / in tests without matchMedia). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m =
        typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query) : null;
      m?.addEventListener('change', cb);
      return () => m?.removeEventListener('change', cb);
    },
    () =>
      typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false,
    () => false,
  );
}

export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
export const useIsMobile = () => !useMediaQuery('(min-width: 768px)');
