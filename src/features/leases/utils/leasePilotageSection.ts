/**
 * Regroupement pilotage : sections 🔴 / 🟠 / 🟢 / ignorés (logique pure).
 */

import type { LeaseWithDetails } from '@/lib/services/leasesService';
import type { LeasePilotageRowMeta, LeasePriorityAction } from './buildLeasePriorityActions';
import type { LeasesActionCounts } from '../types/leasesActionCounts';
import type { NextLeaseActionType } from './getNextLeaseAction';

export type LeasePilotageBucket = 'critique' | 'surveiller' | 'ok' | 'ignored';

const CRITIQUE_ACTIONS = new Set<NextLeaseActionType>([
  'PAY_FULL',
  'PAY_REMAINING',
  'INDEXATION',
  'RENEWAL',
]);

export function classifyLeasePilotageBucket(
  lease: LeaseWithDetails,
  meta: LeasePilotageRowMeta | undefined,
  actionCounts: LeasesActionCounts
): LeasePilotageBucket {
  if (lease.pilotageIgnored || meta?.pilotageIgnored) return 'ignored';

  if (meta) {
    if (meta.paymentGlobale === 'retard') return 'critique';
    if (meta.nextActionType && CRITIQUE_ACTIONS.has(meta.nextActionType)) return 'critique';
    if (meta.paymentGlobale === 'partiel') return 'surveiller';
    if (actionCounts.leaseIdsExpirant90.has(lease.id) || actionCounts.leaseIdsIndexations.has(lease.id)) {
      return 'surveiller';
    }
    return 'ok';
  }

  // Sans timeline locale (ex. mode normal) : mêmes jeux de baux que le ruban filtres
  if (actionCounts.leaseIdsRetards.has(lease.id)) return 'critique';
  if (
    actionCounts.leaseIdsPartiels.has(lease.id) ||
    actionCounts.leaseIdsExpirant90.has(lease.id) ||
    actionCounts.leaseIdsIndexations.has(lease.id)
  ) {
    return 'surveiller';
  }
  return 'ok';
}

export function groupLeasesByPilotageBucket(
  leases: LeaseWithDetails[],
  leasePilotageById: Record<string, LeasePilotageRowMeta>,
  actionCounts: LeasesActionCounts
): Record<LeasePilotageBucket, LeaseWithDetails[]> {
  const out: Record<LeasePilotageBucket, LeaseWithDetails[]> = {
    critique: [],
    surveiller: [],
    ok: [],
    ignored: [],
  };
  for (const l of leases) {
    const b = classifyLeasePilotageBucket(l, leasePilotageById[l.id], actionCounts);
    out[b].push(l);
  }
  return out;
}

/** Même groupement en conservant l’ordre d’une liste déjà triée (ex. tri métier). */
export function partitionSortedLeasesByPilotageBucket(
  sortedLeases: LeaseWithDetails[],
  leasePilotageById: Record<string, LeasePilotageRowMeta>,
  actionCounts: LeasesActionCounts
): Record<LeasePilotageBucket, LeaseWithDetails[]> {
  const out: Record<LeasePilotageBucket, LeaseWithDetails[]> = {
    critique: [],
    surveiller: [],
    ok: [],
    ignored: [],
  };
  for (const l of sortedLeases) {
    const b = classifyLeasePilotageBucket(l, leasePilotageById[l.id], actionCounts);
    out[b].push(l);
  }
  return out;
}

/**
 * Bandeau « Actions prioritaires » = sous-ensemble « À traiter » (bucket critique),
 * dérivé uniquement de `leasePilotageById` + mêmes handlers que le tableau.
 */
export function deriveCritiquePriorityActionsFromPilotage(
  leases: LeaseWithDetails[],
  leasePilotageById: Record<string, LeasePilotageRowMeta>,
  actionCounts: LeasesActionCounts
): LeasePriorityAction[] {
  const out: LeasePriorityAction[] = [];
  for (const lease of leases) {
    if (lease.pilotageIgnored) continue;
    const meta = leasePilotageById[lease.id];
    if (!meta) continue;
    const bucket = classifyLeasePilotageBucket(lease, meta, actionCounts);
    if (bucket !== 'critique') continue;
    const tenantLine = `${lease.Tenant?.firstName ?? ''} ${lease.Tenant?.lastName ?? ''}`.trim();
    out.push({
      leaseId: lease.id,
      propertyName: lease.Property?.name ?? 'Bien',
      tenantLine: tenantLine || 'Locataire',
      primaryLabel: meta.primaryLabel,
      problemLine: meta.problemLine,
      amountLabel: meta.amountLabel,
      amountValue: meta.amountValue,
      ctaKind: meta.ctaKind,
      ctaLabel: meta.ctaLabel,
      urgencyRank: meta.urgencyRank,
      targetYearMonth: meta.targetYearMonth,
      nextActionType: meta.nextActionType,
    });
  }
  out.sort((a, b) => a.urgencyRank - b.urgencyRank);
  return out;
}
