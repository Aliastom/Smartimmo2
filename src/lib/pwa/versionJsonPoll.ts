/**
 * Point d’entrée UNIQUE pour tout GET /version.json côté client.
 * Singleton global + throttle + AbortController pour éviter toute rafale.
 */

import type { AppVersionPayload } from '@/lib/pwa/appVersionTypes';
import { shouldPollDeployVersion } from '@/lib/pwa/deployVersionPoll';

export const VERSION_POLL_SINGLETON_KEY = '__SMARTIMMO_VERSION_POLL_STARTED__' as const;

const VERSION_JSON_PATH = '/version.json';

/** Minimum entre deux tentatives réseau (ms) — aucune rafale < 60 s. */
export const VERSION_FETCH_MIN_GAP_MS = 60_000;

let lastFetchStartedAt = 0;
let fetchInFlight = false;
let activeAbort: AbortController | null = null;

function isDevConsole(): boolean {
  return process.env.NODE_ENV === 'development';
}

export function versionPollDebug(message: string): void {
  if (!isDevConsole()) return;
  console.debug(`[VERSION_POLL] ${message}`);
}

/** Réinitialisé uniquement pour les tests */
export function __resetVersionJsonPollForTests(): void {
  lastFetchStartedAt = 0;
  fetchInFlight = false;
  activeAbort?.abort();
  activeAbort = null;
  if (typeof window !== 'undefined') {
    const w = window as Window & Record<string, boolean>;
    delete w[VERSION_POLL_SINGLETON_KEY];
  }
}

/**
 * Une seule fonction autorise fetch(VERSION_JSON_PATH).
 */
export async function fetchDeployVersionJson(): Promise<AppVersionPayload | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!shouldPollDeployVersion(window)) {
    versionPollDebug('disabled in local dev');
    return null;
  }

  if (fetchInFlight) {
    versionPollDebug('skipped: in flight');
    return null;
  }

  const now = Date.now();
  if (
    now - lastFetchStartedAt < VERSION_FETCH_MIN_GAP_MS &&
    lastFetchStartedAt > 0
  ) {
    versionPollDebug('skipped: throttled');
    return null;
  }

  lastFetchStartedAt = now;
  fetchInFlight = true;
  activeAbort = new AbortController();
  const signal = activeAbort.signal;

  try {
    const r = await fetch(VERSION_JSON_PATH, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!r.ok) {
      return null;
    }
    const data = (await r.json()) as AppVersionPayload;
    return data;
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      versionPollDebug('aborted');
      return null;
    }
    return null;
  } finally {
    fetchInFlight = false;
    if (activeAbort?.signal === signal) {
      activeAbort = null;
    }
  }
}

export function abortDeployVersionJsonFetch(): void {
  activeAbort?.abort();
  activeAbort = null;
}

export type VersionPollLoopHandle = {
  teardown: () => void;
};

/**
 * Démarre interval + listeners une seule fois par onglet (singleton window).
 */
export function tryStartVersionJsonPollLoop(opts: {
  onTick: () => void | Promise<void>;
  intervalMs: number;
}): VersionPollLoopHandle | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!shouldPollDeployVersion(window)) {
    versionPollDebug('disabled in local dev');
    return null;
  }

  const w = window as Window & Record<string, boolean>;
  if (w[VERSION_POLL_SINGLETON_KEY]) {
    versionPollDebug('skipped: singleton already started');
    return null;
  }

  versionPollDebug('started');
  w[VERSION_POLL_SINGLETON_KEY] = true;

  void opts.onTick();

  const intervalId = window.setInterval(() => {
    void opts.onTick();
  }, opts.intervalMs);

  const onVis = () => {
    if (document.visibilityState === 'visible') void opts.onTick();
  };
  const onOnline = () => void opts.onTick();

  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('online', onOnline);

  const teardown = () => {
    window.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('online', onOnline);
    abortDeployVersionJsonFetch();
    w[VERSION_POLL_SINGLETON_KEY] = false;
    versionPollDebug('cleanup: interval + listeners cleared');
  };

  return { teardown };
}
