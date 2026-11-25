/**
 * Lazy page chunks, shared by the router (React.lazy) and the shell, which
 * starts downloading the current page's chunk while the analysis is still
 * running in the worker (otherwise the two would load one after the other).
 */
export const pageChunks = {
  overview: () => import('@/pages/overview'),
  live: () => import('@/pages/live'),
  equipment: () => import('@/pages/equipment'),
  equipmentDetail: () => import('@/pages/equipment/detail'),
  decisions: () => import('@/pages/decisions'),
  anomalies: () => import('@/pages/anomalies'),
  forecast: () => import('@/pages/forecast'),
  carbon: () => import('@/pages/carbon'),
  mv: () => import('@/pages/mv'),
  reports: () => import('@/pages/reports'),
  settings: () => import('@/pages/settings'),
  showcase: () => import('@/pages/_showcase'),
};

type ChunkKey = keyof typeof pageChunks;

/** Chunk of a pathname ("/equipment/comp-2" -> equipmentDetail). */
export function chunkFor(pathname: string): ChunkKey | null {
  const [first, second] = pathname.split('/').filter(Boolean);
  if (!first) return 'overview';
  if (first === 'equipment') return second ? 'equipmentDetail' : 'equipment';
  if (first === 'dev') return 'showcase';
  return first in pageChunks ? (first as ChunkKey) : null;
}

/** Start loading a page chunk (no-op for unknown paths; errors surface on render). */
export function preloadPage(pathname: string): void {
  const key = chunkFor(pathname);
  if (key) pageChunks[key]().catch(() => undefined);
}
