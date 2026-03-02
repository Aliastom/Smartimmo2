/**
 * Store global pour le statut de sync (Logo loader PWA)
 * Permet à LogoWithSyncStatus de lire l'état actuel dès le montage,
 * même si le composant monte après le début de la sync (chunk lazy en prod).
 */

export type SyncStatusValue = 'idle' | 'syncing' | 'error' | 'offline';

let currentStatus: SyncStatusValue = 'idle';
let currentOrgId: string | undefined;

function emitStatus() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('sync:status', {
        detail: { status: currentStatus, organizationId: currentOrgId },
      })
    );
  }
}

export function getSyncStatus(): SyncStatusValue {
  return currentStatus;
}

export function getSyncStatusOrgId(): string | undefined {
  return currentOrgId;
}

export function setSyncStatus(status: SyncStatusValue, organizationId?: string): void {
  const changed = currentStatus !== status || currentOrgId !== organizationId;
  currentStatus = status;
  currentOrgId = organizationId;
  if (changed) {
    emitStatus();
  }
}
