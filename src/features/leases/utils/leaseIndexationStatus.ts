import { normalizeLeaseContractStatus } from './leaseWorkflowStatus';

export type LeaseIndexationStatus = 'NONE' | 'UPCOMING' | 'DUE' | 'APPLIED';

export interface LeaseIndexationInput {
  status: string;
  indexationType?: string | null;
  startDate: string;
}

export interface LeaseIndexationHistoryItem {
  effectiveDate: string;
}

export interface LeaseIndexationStatusResult {
  status: LeaseIndexationStatus;
  anniversaryDate?: string;
  windowStart?: string;
  windowEnd?: string;
  description?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeIndexationType(value: string | null | undefined): string {
  return String(value || '').trim().toUpperCase();
}

function hasIndexationConfigured(value: string | null | undefined): boolean {
  const normalized = normalizeIndexationType(value);
  return normalized !== '' && normalized !== 'NONE' && normalized !== 'AUCUNE';
}

function buildAnniversary(startDate: Date, year: number): Date {
  return new Date(year, startDate.getMonth(), startDate.getDate(), 12, 0, 0, 0);
}

/**
 * Détection V1 de l'indexation :
 * - statut contrat ACTIF
 * - indexation configurée
 * - fenêtre anniversaire J-30 à J+30
 * - APPLIED si une indexation existe déjà dans la fenêtre
 */
export function getLeaseIndexationStatus(
  lease: LeaseIndexationInput,
  history: LeaseIndexationHistoryItem[] = [],
  now: Date = new Date()
): LeaseIndexationStatusResult {
  const contract = normalizeLeaseContractStatus(lease.status);
  if (contract !== 'ACTIF') return { status: 'NONE' };
  if (!hasIndexationConfigured(lease.indexationType)) return { status: 'NONE' };

  const start = new Date(lease.startDate);
  if (Number.isNaN(start.getTime())) return { status: 'NONE' };

  const anniversary = buildAnniversary(start, now.getFullYear());
  const windowStart = new Date(anniversary.getTime() - 30 * DAY_MS);
  const windowEnd = new Date(anniversary.getTime() + 30 * DAY_MS);

  if (now < windowStart || now > windowEnd) {
    return {
      status: 'NONE',
      anniversaryDate: toIsoDate(anniversary),
      windowStart: toIsoDate(windowStart),
      windowEnd: toIsoDate(windowEnd),
    };
  }

  const appliedInWindow = history.some((item) => {
    const d = new Date(item.effectiveDate);
    if (Number.isNaN(d.getTime())) return false;
    return d >= windowStart && d <= windowEnd;
  });

  if (appliedInWindow) {
    return {
      status: 'APPLIED',
      anniversaryDate: toIsoDate(anniversary),
      windowStart: toIsoDate(windowStart),
      windowEnd: toIsoDate(windowEnd),
      description: 'Indexation déjà appliquée pour la période en cours.',
    };
  }

  if (now < anniversary) {
    return {
      status: 'UPCOMING',
      anniversaryDate: toIsoDate(anniversary),
      windowStart: toIsoDate(windowStart),
      windowEnd: toIsoDate(windowEnd),
      description: 'Anniversaire approchant : indexation à préparer.',
    };
  }

  return {
    status: 'DUE',
    anniversaryDate: toIsoDate(anniversary),
    windowStart: toIsoDate(windowStart),
    windowEnd: toIsoDate(windowEnd),
    description: 'Indexation due pour la période en cours.',
  };
}

