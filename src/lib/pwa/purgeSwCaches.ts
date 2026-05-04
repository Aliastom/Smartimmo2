import { pwaDevLog } from '@/lib/pwa/pwaDevLog';

/**
 * Supprime uniquement les entrées Cache Storage utilisées par le SW Workbox / next-pwa.
 * Ne touche pas à IndexedDB, localStorage ni sessionStorage métier.
 */
export async function purgeSwCaches(): Promise<string[]> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return [];
  }

  const keys = await caches.keys();
  const removed: string[] = [];

  for (const key of keys) {
    const isOurCache =
      key.includes('workbox') ||
      key.includes('precache') ||
      key.includes('next-static') ||
      key.includes('api-requests') ||
      key.includes('supabase-') ||
      key.includes('rsc-pages') ||
      key.includes('app-shell') ||
      key.includes('icons') ||
      key.includes('uploads');

    if (isOurCache) {
      await caches.delete(key);
      removed.push(key);
    }
  }

  pwaDevLog('Caches SW supprimés', removed);
  return removed;
}
