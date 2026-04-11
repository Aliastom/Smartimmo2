/**
 * Pilotage global des baux : actions prioritaires + libellés tableau (logique pure, batch IDB).
 */

import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { buildLeaseTimelineSnapshot } from './buildLeaseTimelineSnapshot';
import type { EcheanceForHealth, TransactionForHealth } from './leaseHealthCalculator';
import { getLeaseIndexationStatus, type LeaseIndexationHistoryItem } from './leaseIndexationStatus';
import {
  getNextLeaseAction,
  toLeaseForNextAction,
  type NextLeaseAction,
  type NextLeaseActionType,
} from './getNextLeaseAction';
import { normalizeLeaseContractStatus } from './leaseWorkflowStatus';

const fmtEuro = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

function monthNameFr(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return yearMonth;
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long' });
}

export type LeasePriorityCtaKind = 'encaisser' | 'completer' | 'renouveler' | 'indexer';

export interface LeasePriorityAction {
  leaseId: string;
  propertyName: string;
  tenantLine: string;
  /** Même libellé que la colonne « Action principale » du tableau. */
  primaryLabel: string;
  problemLine: string;
  amountLabel: string;
  amountValue: number;
  ctaKind: LeasePriorityCtaKind;
  ctaLabel: string;
  urgencyRank: number;
  targetYearMonth?: string;
  nextActionType: NextLeaseActionType;
}

export type LeaseRowTone = 'retard' | 'partiel' | 'ok' | 'resilie';

export interface LeasePaymentPilotageMeta {
  currentYearMonth: string;
  currentMonthLabel: string;
  expected: number;
  paid: number;
  remaining: number;
  progress01: number;
  transactionIds: string[];
  /** Lien explicite avec les transactions pour l’action encaissement / complément. */
  transactionHint: 'creates' | 'existing' | 'none';
  primaryTransactionId?: string;
}

export interface LeasePilotageRowMeta {
  /** Colonne « Action principale » */
  primaryLabel: string;
  rowTone: LeaseRowTone;
  /** Statut paiement pour bail ACTIF, sinon null */
  paymentGlobale: 'ok' | 'partiel' | 'retard' | null;
  targetYearMonth?: string;
  nextActionType: NextLeaseActionType;
  pilotageIgnored: boolean;
  /** Champs CTA / tri — même calcul que l’ancien bandeau (source unique). */
  urgencyRank: number;
  amountValue: number;
  amountLabel: string;
  ctaKind: LeasePriorityCtaKind;
  ctaLabel: string;
  problemLine: string;
}

function urgencyForAction(action: NextLeaseAction, cockpitMontantRetard: number): number {
  const base: Record<NextLeaseActionType, number> = {
    PAY_FULL: 0,
    PAY_REMAINING: 1,
    INDEXATION: 2,
    RENEWAL: 3,
    GENERATE_RECEIPT: 50,
    NONE: 100,
  };
  const tie = action.amount ?? cockpitMontantRetard;
  return base[action.type] * 1000 - Math.min(tie, 999);
}

function mapCta(action: NextLeaseAction): { kind: LeasePriorityCtaKind; label: string } {
  switch (action.type) {
    case 'PAY_FULL':
      return { kind: 'encaisser', label: 'Encaisser' };
    case 'PAY_REMAINING':
      return { kind: 'completer', label: 'Compléter paiement' };
    case 'INDEXATION':
      return { kind: 'indexer', label: 'Indexer' };
    case 'RENEWAL':
      return { kind: 'renouveler', label: 'Renouveler bail' };
    default:
      return { kind: 'encaisser', label: 'Traiter' };
  }
}

/** Libellé décisionnel pour la colonne tableau */
export function formatLeasePrimaryTableLabel(action: NextLeaseAction): string {
  switch (action.type) {
    case 'PAY_REMAINING':
      return action.amount != null ? `Compléter ${fmtEuro(action.amount)}` : 'Compléter paiement';
    case 'PAY_FULL':
      if (action.month) return `Encaisser ${monthNameFr(action.month)}`;
      return 'Encaisser';
    case 'INDEXATION':
      return 'Indexer';
    case 'RENEWAL':
      return 'Renouveler bail';
    case 'GENERATE_RECEIPT':
      return 'Générer quittance';
    case 'NONE': {
      const l = action.label;
      if (l === 'Aucune action requise') return 'Rien à faire';
      return l;
    }
    default:
      return action.label || '—';
  }
}

function rowToneForLease(
  leaseStatus: string,
  cockpit: { statutGlobal: 'ok' | 'partiel' | 'retard' }
): LeaseRowTone {
  const c = normalizeLeaseContractStatus(leaseStatus);
  if (c === 'RESILIE' || c === 'ARCHIVE') return 'resilie';
  if (c !== 'ACTIF') return 'ok';
  if (cockpit.statutGlobal === 'retard') return 'retard';
  if (cockpit.statutGlobal === 'partiel') return 'partiel';
  return 'ok';
}

export interface BuildLeasePriorityActionsInput {
  leases: LeaseWithDetails[];
  allEcheances: EcheanceForHealth[];
  allTransactions: TransactionForHealth[];
  indexationsByLease: Map<string, LeaseIndexationHistoryItem[]>;
  now?: Date;
}

export interface BuildLeasePriorityActionsResult {
  leasePilotageById: Record<string, LeasePilotageRowMeta>;
  leasePaymentPilotageById: Record<string, LeasePaymentPilotageMeta>;
}

/**
 * Construit la liste triée des actions prioritaires + les métadonnées par bail pour le tableau.
 */
function currentYearMonthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function buildLeasePriorityActions(input: BuildLeasePriorityActionsInput): BuildLeasePriorityActionsResult {
  const now = input.now ?? new Date();
  const currentYm = currentYearMonthKey(now);
  const echByLease = new Map<string, EcheanceForHealth[]>();
  const txByLease = new Map<string, TransactionForHealth[]>();

  for (const e of input.allEcheances) {
    const lid = e.leaseId;
    if (!lid) continue;
    const arr = echByLease.get(lid) ?? [];
    arr.push(e);
    echByLease.set(lid, arr);
  }
  for (const t of input.allTransactions) {
    const lid = (t as TransactionForHealth & { leaseId?: string }).leaseId;
    if (!lid) continue;
    const arr = txByLease.get(lid) ?? [];
    arr.push(t);
    txByLease.set(lid, arr);
  }

  const leasePilotageById: Record<string, LeasePilotageRowMeta> = {};
  const leasePaymentPilotageById: Record<string, LeasePaymentPilotageMeta> = {};

  for (const lease of input.leases) {
    const ech = echByLease.get(lease.id) ?? [];
    const txs = txByLease.get(lease.id) ?? [];
    const { months, cockpit } = buildLeaseTimelineSnapshot(
      {
        paymentDay: lease.paymentDay,
        startDate: lease.startDate,
        status: lease.status,
        rentAmount: lease.rentAmount,
        chargesRecupMensuelles: lease.chargesRecupMensuelles ?? 0,
      },
      ech,
      txs,
      now
    );

    const idx = getLeaseIndexationStatus(
      {
        status: lease.status,
        indexationType: lease.indexationType,
        startDate: lease.startDate,
      },
      input.indexationsByLease.get(lease.id) ?? [],
      now
    );

    const action = getNextLeaseAction(
      toLeaseForNextAction(lease),
      { months, cockpit, loading: false },
      { indexationStatus: idx.status },
      now
    );

    const pilotageIgnored = Boolean((lease as { pilotageIgnored?: boolean }).pilotageIgnored);

    const monthRowForDisplay =
      months.find((m) => m.yearMonth === currentYm && m.expected > 0) ??
      months.find((m) => m.yearMonth === currentYm) ??
      months.filter((m) => m.expected > 0).pop();
    const targetYmForTx = action.month || monthRowForDisplay?.yearMonth || currentYm;
    const rowForActionMonth = months.find((m) => m.yearMonth === targetYmForTx);
    const txIds = rowForActionMonth?.transactionIds ?? monthRowForDisplay?.transactionIds ?? [];
    const expected =
      rowForActionMonth?.expected ?? monthRowForDisplay?.expected ?? lease.rentAmount + (lease.chargesRecupMensuelles ?? 0);
    const paid = rowForActionMonth?.realized ?? monthRowForDisplay?.realized ?? 0;
    const remaining = Math.max(0, expected - paid);
    const progress01 = expected > 0 ? Math.min(1, paid / expected) : 0;
    let transactionHint: LeasePaymentPilotageMeta['transactionHint'] = 'none';
    if (action.type === 'PAY_FULL' || action.type === 'PAY_REMAINING') {
      transactionHint = txIds.length > 0 ? 'existing' : 'creates';
    }

    leasePaymentPilotageById[lease.id] = {
      currentYearMonth: monthRowForDisplay?.yearMonth ?? currentYm,
      currentMonthLabel: monthRowForDisplay?.label ?? currentYm,
      expected,
      paid,
      remaining,
      progress01,
      transactionIds: txIds,
      transactionHint,
      primaryTransactionId: txIds[0],
    };

    const { kind, label } = mapCta(action);
    const amountValue =
      action.amount ??
      (action.type === 'PAY_FULL' || action.type === 'PAY_REMAINING' ? cockpit.montantEnRetard : 0);
    const amountLabel =
      action.type === 'INDEXATION' || action.type === 'RENEWAL'
        ? '—'
        : amountValue > 0
          ? fmtEuro(amountValue)
          : '—';
    const urgencyRank = urgencyForAction(action, cockpit.montantEnRetard);
    const primaryLabel = formatLeasePrimaryTableLabel(action);
    const problemLine = action.description ?? action.label;

    leasePilotageById[lease.id] = {
      primaryLabel,
      rowTone: rowToneForLease(lease.status, cockpit),
      paymentGlobale: normalizeLeaseContractStatus(lease.status) === 'ACTIF' ? cockpit.statutGlobal : null,
      targetYearMonth: action.month,
      nextActionType: action.type,
      pilotageIgnored,
      urgencyRank,
      amountValue,
      amountLabel,
      ctaKind: kind,
      ctaLabel: label,
      problemLine,
    };
  }

  return { leasePilotageById, leasePaymentPilotageById };
}

/** Construit l’objet attendu par `handlePriorityActionCta` à partir du meta tableau (même handlers que le bandeau). */
export function toLeasePriorityAction(lease: LeaseWithDetails, meta: LeasePilotageRowMeta): LeasePriorityAction {
  const tenantLine = `${lease.Tenant?.firstName ?? ''} ${lease.Tenant?.lastName ?? ''}`.trim();
  return {
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
  };
}
