/**
 * Diagnostic structuré du workflow App Shell « Envoyer pour signature »
 * (sync FK property/tenant → POST /api/leases → send-for-signature).
 *
 * Activation :
 * - Définir sessionStorage `__smartimmo_lease_sign_diag` = id local du bail (fait par LeaseEditModal)
 * - ou NEXT_PUBLIC_LEASE_SIGN_DIAG=1 pour tout tracer (bruyant)
 */

export type SmartimmoIdKind = 'uuid_local' | 'cuid_remote' | 'empty' | 'other';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Heuristique : UUID v4 = id généré côté client (offline) ; cuid Prisma ≈ id serveur */
export function classifySmartimmoId(id: string | null | undefined): SmartimmoIdKind {
  if (id == null || id === '') return 'empty';
  const s = String(id);
  if (UUID_RE.test(s)) return 'uuid_local';
  if (/^[a-z][a-z0-9]{24}$/i.test(s)) return 'cuid_remote';
  return 'other';
}

export const LEASE_SIGN_DIAG_STORAGE_KEY = '__smartimmo_lease_sign_diag';

const REMOTE_LEASE_KEY = '__smartimmo_lease_sign_diag_remote_lease';
const MEM_LEASE_KEY = '__smartimmo_lease_sign_diag_mem';
const MEM_VERBOSE_KEY = '__smartimmo_lease_sign_diag_verbose_mem';

export function clearLeaseSignatureDiagRemoteLeaseMapping(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(REMOTE_LEASE_KEY);
  } catch {
    /* ignore */
  }
}

export function setLeaseSignatureDiagSession(leaseLocalId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (leaseLocalId) {
      sessionStorage.setItem(LEASE_SIGN_DIAG_STORAGE_KEY, leaseLocalId);
      (window as any)[MEM_LEASE_KEY] = leaseLocalId;
      (window as any)[MEM_VERBOSE_KEY] = true;
      clearLeaseSignatureDiagRemoteLeaseMapping();
    } else {
      sessionStorage.removeItem(LEASE_SIGN_DIAG_STORAGE_KEY);
      (window as any)[MEM_LEASE_KEY] = null;
      (window as any)[MEM_VERBOSE_KEY] = false;
      clearLeaseSignatureDiagRemoteLeaseMapping();
    }
  } catch {
    // Fallback mémoire si sessionStorage indisponible (privacy mode / quota / etc.)
    (window as any)[MEM_LEASE_KEY] = leaseLocalId;
    (window as any)[MEM_VERBOSE_KEY] = !!leaseLocalId;
  }
}

export function getLeaseSignatureDiagLeaseId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromStorage = sessionStorage.getItem(LEASE_SIGN_DIAG_STORAGE_KEY);
    if (fromStorage) return fromStorage;
    return (window as any)[MEM_LEASE_KEY] || null;
  } catch {
    return (window as any)[MEM_LEASE_KEY] || null;
  }
}

export function isLeaseSignatureDiagVerbose(): boolean {
  // Memory flag (runtime immédiat, ne dépend pas du build)
  if (typeof window !== 'undefined' && (window as any)[MEM_VERBOSE_KEY]) {
    return true;
  }
  // Build-time flag (nécessite relance du dev server si changé)
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_LEASE_SIGN_DIAG === '1') {
    return true;
  }
  return !!getLeaseSignatureDiagLeaseId();
}

const LOG_TAG = '[LEASE_SIGN_WORKFLOW_DIAG]';

export type LeaseSignDiagEvent = {
  step:
    | '1_before_sync_property'
    | '2_after_sync_property'
    | '3_before_sync_tenant'
    | '4_after_sync_tenant'
    | '5_before_post_api_leases'
    | '6_after_post_api_leases'
    | '7_before_send_for_signature'
    | 'preflight_pending_ops_snapshot'
    | 'preflight_pending_op_decision'
    | 'preflight_sync_skipped_remote_lease';
  organizationId?: string;
  pendingOpId?: string;
  /** Payload JSON exact (étape 5) — pas de données sensibles métier hors IDs */
  requestBodyJson?: string;
  [key: string]: unknown;
};

export function logLeaseSignWorkflowDiag(event: LeaseSignDiagEvent): void {
  if (!isLeaseSignatureDiagVerbose()) return;
  const line = JSON.stringify({
    tag: 'LEASE_SIGN_WORKFLOW_DIAG',
    ts: new Date().toISOString(),
    ...event,
  });
  // Console navigateur (source de vérité côté client)
  console.log(LOG_TAG, line);
  // Log visible même si le filtre console masque les logs standard
  console.warn(`${LOG_TAG} STEP=${event.step}`);
  // Relai best-effort vers serveur pour visibilité terminal
  if (typeof window !== 'undefined') {
    fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'info',
        source: 'lease-sign-diag',
        message: line,
      }),
    }).catch(() => {});
  }
}

export function summarizeFkPair(propertyId: unknown, tenantId: unknown) {
  const p = propertyId == null ? '' : String(propertyId);
  const t = tenantId == null ? '' : String(tenantId);
  return {
    propertyId: p,
    propertyIdKind: classifySmartimmoId(p),
    tenantId: t,
    tenantIdKind: classifySmartimmoId(t),
  };
}

/** Après POST /api/leases réussi (étape 6), mémoriser pour comparer à l’URL send-for-signature */
export function setLeaseSignatureDiagRemoteLeaseMapping(localLeaseId: string, remoteLeaseId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      REMOTE_LEASE_KEY,
      JSON.stringify({ localLeaseId, remoteLeaseId, ts: Date.now() })
    );
  } catch {
    /* ignore */
  }
}

export function getLeaseSignatureDiagRemoteLeaseMapping(): {
  localLeaseId: string;
  remoteLeaseId: string;
  ts: number;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(REMOTE_LEASE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { localLeaseId: string; remoteLeaseId: string; ts: number };
  } catch {
    return null;
  }
}
