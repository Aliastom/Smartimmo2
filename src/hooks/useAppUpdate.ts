'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { AppVersionPayload } from '@/lib/pwa/appVersionTypes';
import { getBootAppVersion, hasCommitMismatch } from '@/lib/pwa/bootAppVersion';
import { shouldPollDeployVersion } from '@/lib/pwa/deployVersionPoll';
import { fetchDeployVersionJson, tryStartVersionJsonPollLoop } from '@/lib/pwa/versionJsonPoll';
import { purgeSwCaches } from '@/lib/pwa/purgeSwCaches';
import { pwaDevLog, pwaDebugLog } from '@/lib/pwa/pwaDevLog';

const VERSION_POLL_MS = 5 * 60 * 1000;
const SW_POLL_MS = 60 * 60 * 1000;
const BC_CHANNEL = 'smartimmo-pwa-update';

export type AppUpdateReason = 'sw-waiting' | 'version-mismatch';

export type AppUpdateState = {
  waitingWorker: ServiceWorker | null;
  isUpdateAvailable: boolean;
  updateReason: AppUpdateReason | null;
  bootVersion: AppVersionPayload;
  remoteVersion: AppVersionPayload | null;
  updateServiceWorker: () => Promise<void>;
  dismissUpdate: () => void;
  reloadWithoutCache: () => Promise<void>;
};

function hardReload(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('__swu', String(Date.now()));
  window.location.replace(url.toString());
}

export function useAppUpdate(): AppUpdateState {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [versionMismatch, setVersionMismatch] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<AppVersionPayload | null>(null);
  const [dismissedMismatchCommit, setDismissedMismatchCommit] = useState<string | null>(null);
  const [swDismissed, setSwDismissed] = useState(false);

  const bootVersion = useMemo(() => getBootAppVersion(), []);
  const reloadScheduled = useRef(false);

  const updateReason: AppUpdateReason | null = waitingWorker
    ? 'sw-waiting'
    : versionMismatch
      ? 'version-mismatch'
      : null;

  const dismissedRemoteEqualsCurrent =
    remoteVersion?.commit && dismissedMismatchCommit === remoteVersion.commit;

  const isUpdateAvailable =
    (waitingWorker !== null && !swDismissed) ||
    (versionMismatch && !!remoteVersion && !dismissedRemoteEqualsCurrent);

  /**
   * Polling /version.json : module `versionJsonPoll` (singleton + throttle 60s + seul fetch autorisé).
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const boot = getBootAppVersion();

    const tick = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }
      const remote = await fetchDeployVersionJson();
      if (!remote) return;

      setRemoteVersion(remote);
      const mismatch = hasCommitMismatch(remote, boot);
      setVersionMismatch(mismatch);
      if (mismatch) {
        pwaDebugLog('version.json: commit distant ≠ bundle', {
          remote: remote.commit,
          boot: boot.commit,
        });
      }
    };

    const loop = tryStartVersionJsonPollLoop({
      onTick: tick,
      intervalMs: VERSION_POLL_MS,
    });
    if (!loop) return;
    return () => loop.teardown();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !shouldPollDeployVersion(window)) {
      return;
    }
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;

    const syncWaitingState = (registration: ServiceWorkerRegistration) => {
      if (cancelled) return;
      if (registration.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting);
        setSwDismissed(false);
        pwaDebugLog('SW waiting présent');
      }
    };

    const wire = (registration: ServiceWorkerRegistration) => {
      syncWaitingState(registration);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (cancelled) return;
          if (installing.state === 'installed' && navigator.serviceWorker.controller && registration.waiting) {
            setWaitingWorker(registration.waiting);
            setSwDismissed(false);
            pwaDebugLog('SW nouvelle version installée → waiting');
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration && !cancelled) wire(registration);
    });

    const swInterval = window.setInterval(() => {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (!registration || cancelled) return;
        registration.update().catch(() => undefined);
        syncWaitingState(registration);
      });
    }, SW_POLL_MS);

    const onFocus = () => {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (!registration || cancelled) return;
        registration.update().catch(() => undefined);
        syncWaitingState(registration);
      });
    };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(swInterval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isChunkLoadError = (error: unknown): boolean => {
      const text = String(error || '');
      return (
        text.includes('ChunkLoadError') ||
        text.includes('Loading chunk') ||
        text.includes('_next/static/chunks')
      );
    };

    const recoverFromStaleChunks = () => {
      const guardKey = 'smartimmo.chunk-reload-once';
      const alreadyRetried = sessionStorage.getItem(guardKey) === '1';
      if (alreadyRetried) return;
      sessionStorage.setItem(guardKey, '1');
      hardReload();
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        recoverFromStaleChunks();
      }
    };

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production') return;
    if (typeof BroadcastChannel === 'undefined') return;

    const bc = new BroadcastChannel(BC_CHANNEL);
    bc.onmessage = (ev: MessageEvent) => {
      if (ev.data?.type === 'reload-for-update' && !reloadScheduled.current) {
        reloadScheduled.current = true;
        hardReload();
      }
    };
    return () => bc.close();
  }, []);

  const broadcastReload = useCallback(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    try {
      const bc = new BroadcastChannel(BC_CHANNEL);
      bc.postMessage({ type: 'reload-for-update' });
      bc.close();
    } catch {
      /* ignore */
    }
  }, []);

  const updateServiceWorker = useCallback(async () => {
    if (typeof window === 'undefined') return;

    reloadScheduled.current = false;

    const scheduleReload = () => {
      if (reloadScheduled.current) return;
      reloadScheduled.current = true;
      broadcastReload();
      hardReload();
    };

    const runWithTimeoutFallback = () => {
      window.setTimeout(() => {
        if (!reloadScheduled.current) {
          pwaDevLog('Fallback reload après délai (controllerchange absent)');
          scheduleReload();
        }
      }, 4000);
    };

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
      await registration?.update().catch(() => undefined);

      let targetWaiting = registration?.waiting ?? null;
      if (!targetWaiting && registration?.installing) {
        await new Promise<void>((resolve) => {
          const iw = registration.installing!;
          const done = () => {
            iw.removeEventListener('statechange', onState);
            resolve();
          };
          const onState = () => {
            if (iw.state === 'installed' || iw.state === 'activated') done();
          };
          iw.addEventListener('statechange', onState);
          window.setTimeout(done, 1500);
        });
        const reg2 = await navigator.serviceWorker.getRegistration();
        targetWaiting = reg2?.waiting ?? null;
      }

      const w = targetWaiting ?? waitingWorker;
      if (w) {
        const onCtrl = () => {
          navigator.serviceWorker.removeEventListener('controllerchange', onCtrl);
          scheduleReload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', onCtrl);
        w.postMessage({ type: 'SKIP_WAITING' });
        runWithTimeoutFallback();
        return;
      }
    }

    await purgeSwCaches();
    pwaDevLog('Mise à jour sans SW waiting : purge caches + reload');
    scheduleReload();
  }, [broadcastReload, waitingWorker]);

  const reloadWithoutCache = useCallback(async () => {
    const removed = await purgeSwCaches();
    pwaDevLog('Rechargement sans cache (fallback)', removed);

    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch {
        /* ignore */
      }
    }

    reloadScheduled.current = true;
    hardReload();
  }, []);

  const dismissUpdate = useCallback(() => {
    if (waitingWorker) {
      setSwDismissed(true);
      setWaitingWorker(null);
    }
    if (versionMismatch && remoteVersion?.commit) {
      setDismissedMismatchCommit(remoteVersion.commit);
    }
  }, [waitingWorker, versionMismatch, remoteVersion?.commit]);

  return {
    waitingWorker,
    isUpdateAvailable,
    updateReason,
    bootVersion,
    remoteVersion,
    updateServiceWorker,
    dismissUpdate,
    reloadWithoutCache,
  };
}
