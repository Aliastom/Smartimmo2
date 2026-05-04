'use client';

/**
 * @deprecated Préférer `useAppUpdate` (version.json + service worker).
 * Conservé pour compatibilité avec les imports historiques.
 */
export { useAppUpdate as useServiceWorkerUpdate } from '@/hooks/useAppUpdate';
export type { AppUpdateState as ServiceWorkerUpdateState, AppUpdateReason } from '@/hooks/useAppUpdate';
