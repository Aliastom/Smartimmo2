/**
 * Instrumentation dev pour diagnostiquer la navigation App Shell (opt-in).
 * Activer : NEXT_PUBLIC_DEBUG_NAV_AUDIT=1 dans .env.local
 */

export const DEBUG_NAV_AUDIT =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_NAV_AUDIT === '1';

let lastNavigationSource: string | null = null;

export function navAuditSetSource(source: string): void {
  if (!DEBUG_NAV_AUDIT) return;
  lastNavigationSource = source;
}

export function navAuditTakeSource(): string | null {
  if (!DEBUG_NAV_AUDIT) return null;
  const s = lastNavigationSource;
  lastNavigationSource = null;
  return s;
}

export function navAuditLog(...args: unknown[]): void {
  if (!DEBUG_NAV_AUDIT) return;
  // eslint-disable-next-line no-console -- dev-only audit
  console.debug('[NAV_AUDIT]', ...args);
}

let fetchPatched = false;

/** Compte / journalise les fetch réseau (dev, flag uniquement). */
export function navAuditInstallFetchHook(): void {
  if (!DEBUG_NAV_AUDIT || typeof window === 'undefined' || fetchPatched) return;
  fetchPatched = true;
  const orig = window.fetch.bind(window);
  window.fetch = function navAuditFetch(input: RequestInfo | URL, init?: RequestInit) {
    try {
      const u = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      navAuditLog('fetch', u);
    } catch {
      navAuditLog('fetch', '(url?)');
    }
    return orig(input, init);
  };
}

let historyPatched = false;

/** Log pushState/replaceState (dev, flag uniquement). */
export function navAuditInstallHistoryHook(): void {
  if (!DEBUG_NAV_AUDIT || typeof window === 'undefined' || historyPatched) return;
  historyPatched = true;
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);
  history.pushState = function navAuditPushState(...args: Parameters<History['pushState']>) {
    navAuditLog('history.pushState', args[2], args[0]);
    return originalPushState(...args);
  };
  history.replaceState = function navAuditReplaceState(...args: Parameters<History['replaceState']>) {
    navAuditLog('history.replaceState', args[2], args[0]);
    return originalReplaceState(...args);
  };
  const onPopState = (e: PopStateEvent) => {
    navAuditLog('popstate', typeof window !== 'undefined' ? window.location.href : '', e.state);
  };
  window.addEventListener('popstate', onPopState);
  // Pas de cleanup global : hook vivant sur la session (dev-only).
}
