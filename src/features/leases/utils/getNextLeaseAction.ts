import type { LeasePaymentsTimelineMonth, LeasePaymentsTimelineResult } from '../hooks/useLeasePaymentsTimeline';
import { getDaysUntilExpiration, getDaysUntilIndexation } from '@/utils/leaseStatus';
import { normalizeLeaseContractStatus } from './leaseWorkflowStatus';
import type { LeaseIndexationStatus } from './leaseIndexationStatus';

export type NextLeaseActionType =
  | 'PAY_REMAINING'
  | 'PAY_FULL'
  | 'GENERATE_RECEIPT'
  | 'INDEXATION'
  | 'RENEWAL'
  | 'NONE';

export interface NextLeaseAction {
  type: NextLeaseActionType;
  label: string;
  description?: string;
  amount?: number;
  month?: string;
}

/** Champs bail nécessaires au moteur (pas de dépendance Prisma côté domaine pur). */
export interface LeaseForNextAction {
  id: string;
  status: string;
  startDate: string;
  endDate?: string | null;
  indexationType?: string | null;
}

/** Signaux hors timeline (quittance manquante, etc.) — pas d’accès IDB ici. */
export interface LeaseNextActionFinancialInput {
  /** Mois YYYY-MM pour lequel une quittance est attendue alors que les paiements sont à jour. */
  pendingReceipt?: { yearMonth: string; label: string };
  /** Statut d'indexation évalué via historique local (évite de reproposer après application). */
  indexationStatus?: LeaseIndexationStatus;
}

export type PaymentsTimelineInput = Pick<
  LeasePaymentsTimelineResult,
  'months' | 'cockpit' | 'loading'
>;

const INDEXATION_RENEWAL_STATUSES = new Set([
  'ACTIF',
  'ACTIVE',
  'SIGNÉ',
  'SIGNE',
  'SIGNED',
]);

function formatEuro(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function monthNameFromYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return yearMonth;
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long' });
}

function hasIndexationConfigured(indexationType: string | null | undefined): boolean {
  if (indexationType == null || indexationType === '') return false;
  const t = String(indexationType).toUpperCase();
  return t !== 'NONE' && t !== 'AUCUNE';
}

function indexationLabel(indexationType: string | null | undefined): string {
  const raw = String(indexationType || '').toLowerCase();
  if (raw === 'insee' || raw === 'irl') return 'IRL';
  if (raw === 'manual') return 'manuelle';
  return 'IRL';
}

function findFirstPartial(months: LeasePaymentsTimelineMonth[]): LeasePaymentsTimelineMonth | undefined {
  return months.find((m) => m.status === 'partiel' && m.expected > 0);
}

function findFirstFullRetard(months: LeasePaymentsTimelineMonth[]): LeasePaymentsTimelineMonth | undefined {
  return months.find((m) => m.status === 'en_retard' && m.realized === 0 && m.expected > 0);
}

function isIndexationDueSoon(lease: LeaseForNextAction, now: Date): boolean {
  if (!INDEXATION_RENEWAL_STATUSES.has(lease.status)) return false;
  if (!hasIndexationConfigured(lease.indexationType)) return false;
  const days = getDaysUntilIndexation({
    id: lease.id,
    status: lease.status,
    startDate: lease.startDate,
    endDate: lease.endDate ?? undefined,
  });
  return days !== null && days >= 0 && days <= 30;
}

function isRenewalSoon(lease: LeaseForNextAction, now: Date): boolean {
  if (!lease.endDate) return false;
  if (!INDEXATION_RENEWAL_STATUSES.has(lease.status)) return false;
  const days = getDaysUntilExpiration({
    id: lease.id,
    status: lease.status,
    startDate: lease.startDate,
    endDate: lease.endDate,
  });
  return days !== null && days > 0 && days <= 90;
}

/**
 * Prochaine action métier recommandée pour un bail (logique pure, testable).
 * Priorité : partiel → retard 0 € → quittance (signal explicite) → indexation → fin < 90 j → aucune.
 */
export function getNextLeaseAction(
  lease: LeaseForNextAction,
  paymentsTimeline: PaymentsTimelineInput,
  financialData: LeaseNextActionFinancialInput = {},
  now: Date = new Date()
): NextLeaseAction {
  const contractStatus = normalizeLeaseContractStatus(lease.status);
  if (contractStatus === 'BROUILLON') {
    return { type: 'NONE', label: 'Envoyer pour signature' };
  }
  if (contractStatus === 'A_SIGNER') {
    return { type: 'NONE', label: 'Attendre la signature' };
  }
  if (contractStatus === 'RESILIE' || contractStatus === 'ARCHIVE') {
    return { type: 'NONE', label: 'Aucune action requise' };
  }

  const { months, cockpit } = paymentsTimeline;

  const partial = findFirstPartial(months);
  if (partial) {
    const reste = Math.max(0, partial.expected - partial.realized);
    const mois = monthNameFromYearMonth(partial.yearMonth);
    return {
      type: 'PAY_REMAINING',
      label: `Compléter paiement ${mois} (${formatEuro(reste)})`,
      description: `Reste dû sur la période ${partial.label}.`,
      amount: reste,
      month: partial.yearMonth,
    };
  }

  const fullRetard = findFirstFullRetard(months);
  if (fullRetard) {
    const mois = monthNameFromYearMonth(fullRetard.yearMonth);
    return {
      type: 'PAY_FULL',
      label: `Encaisser loyer ${mois} (${formatEuro(fullRetard.expected)})`,
      description: `Aucun encaissement enregistré pour ${fullRetard.label}.`,
      amount: fullRetard.expected,
      month: fullRetard.yearMonth,
    };
  }

  if (cockpit.statutGlobal === 'ok' && financialData.pendingReceipt) {
    const { label, yearMonth } = financialData.pendingReceipt;
    return {
      type: 'GENERATE_RECEIPT',
      label: `Générer la quittance (${label})`,
      description: 'Le loyer est à jour pour cette période.',
      month: yearMonth,
    };
  }

  if (financialData.indexationStatus === 'DUE' || (!financialData.indexationStatus && isIndexationDueSoon(lease, now))) {
    const kind = indexationLabel(lease.indexationType);
    return {
      type: 'INDEXATION',
      label: `Indexer le loyer (${kind})`,
      description: "Date d'anniversaire d'indexation dans les 30 prochains jours.",
    };
  }

  if (isRenewalSoon(lease, now)) {
    const days = getDaysUntilExpiration({
      id: lease.id,
      status: lease.status,
      startDate: lease.startDate,
      endDate: lease.endDate!,
    });
    return {
      type: 'RENEWAL',
      label: 'Préparer le renouvellement du bail',
      description: days != null ? `Fin du bail dans ${days} jour${days > 1 ? 's' : ''}.` : undefined,
    };
  }

  if (cockpit.statutGlobal === 'ok') {
    return {
      type: 'NONE',
      label: 'Aucune action requise',
    };
  }

  return {
    type: 'NONE',
    label: 'Aucune action requise',
    description: 'Aucune priorité de pilotage détectée pour ce bail.',
  };
}

/** Libellé court pour tableaux (une ligne). */
export function getNextLeaseActionShortLabel(action: NextLeaseAction): string {
  switch (action.type) {
    case 'PAY_REMAINING':
      return action.amount != null ? `Payer ${formatEuro(action.amount)}` : 'Compléter';
    case 'PAY_FULL': {
      if (action.month) {
        const mois = monthNameFromYearMonth(action.month);
        return `Encaisser ${mois}`;
      }
      return 'Encaisser';
    }
    case 'GENERATE_RECEIPT':
      return 'Générer quittance';
    case 'INDEXATION':
      return 'Indexer';
    case 'RENEWAL':
      return 'Renouveler';
    default:
      if (
        action.label === 'Compléter le bail' ||
        action.label === 'Envoyer pour signature' ||
        action.label === 'Attendre la signature'
      ) {
        return action.label;
      }
      return '—';
  }
}

export function toLeaseForNextAction(
  lease: Pick<LeaseForNextAction, 'id' | 'status' | 'startDate' | 'endDate' | 'indexationType'>
): LeaseForNextAction {
  return {
    id: lease.id,
    status: lease.status,
    startDate: lease.startDate,
    endDate: lease.endDate ?? null,
    indexationType: lease.indexationType ?? null,
  };
}
