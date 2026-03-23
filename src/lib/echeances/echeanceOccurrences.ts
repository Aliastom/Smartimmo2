/**
 * Occurrences théoriques d'une échéance (règle récurrente) et couverture par transactions liées.
 * Modèle : échéance = règle, occurrence = date à couvrir, transaction = réalisation.
 */

import type { EcheanceRecurrente } from '@/types/echeance';
import { expandEcheances, type EcheanceRecurrenteInput, type Occurrence } from '@/lib/echeances/expandEcheances';
import type { NextOccurrenceInfo } from '@/lib/echeances/echeanceCashflowHelpers';
import type { EcheanceStatutTemporel } from '@/types/echeance';

export function toEcheanceInput(e: EcheanceRecurrente): EcheanceRecurrenteInput {
  return {
    id: e.id,
    propertyId: e.propertyId,
    leaseId: e.leaseId,
    label: e.label,
    type: e.type,
    periodicite: e.periodicite,
    montant: e.montant,
    recuperable: e.recuperable,
    sens: e.sens,
    startAt: e.startAt,
    endAt: e.endAt,
    isActive: e.isActive,
  };
}

function ymdFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: string, b: string): number {
  const t0 = new Date(a.slice(0, 10) + 'T12:00:00').getTime();
  const t1 = new Date(b.slice(0, 10) + 'T12:00:00').getTime();
  return Math.round(Math.abs(t1 - t0) / (24 * 60 * 60 * 1000));
}

/**
 * Occurrences théoriques entre deux mois (YYYY-MM), triées.
 */
export function computeOccurrences(
  echeance: EcheanceRecurrente,
  fromYm: string,
  toYm: string
): Occurrence[] {
  return expandEcheances([toEcheanceInput(echeance)], fromYm, toYm);
}

function uniqueSortedDates(occ: Occurrence[]): string[] {
  return [...new Set(occ.map((o) => o.date))].sort();
}

/** Dates théoriques (fenêtre étendue) pour couverture / matching des liens. */
export function listTheoreticalOccurrenceDates(echeance: EcheanceRecurrente, refDate: Date = new Date()): string[] {
  const y = refDate.getFullYear();
  const from = `${y - 2}-01`;
  const to = `${y + 15}-12`;
  return uniqueSortedDates(computeOccurrences(echeance, from, to));
}

export interface LinkLike {
  occurrenceDate?: string | null;
  transactionId: string;
}

/**
 * Dates d'occurrence considérées comme couvertes par les liens + dates de transaction.
 */
export function buildCoveredOccurrenceDates(
  theoreticalDates: string[],
  links: LinkLike[],
  transactionDateById: Map<string, string>,
  dateToleranceDays: number
): Set<string> {
  const covered = new Set<string>();
  const setTheoretical = new Set(theoreticalDates);

  for (const link of links) {
    const txYmd = (transactionDateById.get(link.transactionId) || '').slice(0, 10);
    if (link.occurrenceDate) {
      const occ = link.occurrenceDate.slice(0, 10);
      if (setTheoretical.has(occ)) {
        covered.add(occ);
        continue;
      }
      const closest = theoreticalDates.reduce<{ d: string; dist: number } | null>((best, d) => {
        const dist = daysBetween(d, occ);
        if (dist > dateToleranceDays) return best;
        if (!best || dist < best.dist) return { d, dist };
        return best;
      }, null);
      if (closest) covered.add(closest.d);
      else covered.add(occ);
      continue;
    }
    if (txYmd) {
      let best: { d: string; dist: number } | null = null;
      for (const d of theoreticalDates) {
        const dist = daysBetween(d, txYmd);
        if (dist <= dateToleranceDays && (!best || dist < best.dist)) best = { d, dist };
      }
      if (best) covered.add(best.d);
    }
  }
  return covered;
}

const SOON_DAYS = 7;

function buildNextOccurrenceMessage(target: string, today: string, days: number): string {
  if (target === today) return "Prochaine occurrence aujourd'hui";
  if (target < today) return 'Occurrence à couvrir (passée)';
  if (days <= SOON_DAYS) return `À venir dans ${days} jour${days > 1 ? 's' : ''}`;
  if (days < 35) return `À venir dans ${days} jours`;
  const months = Math.round(days / 30);
  return months >= 1 ? `À venir dans environ ${months} mois` : `À venir dans ${days} jours`;
}

function temporalForTarget(target: string, today: string): EcheanceStatutTemporel {
  if (target < today) return 'echue';
  return 'a_venir';
}

/**
 * Première occurrence non couverte (la plus ancienne dans la fenêtre), ou null si aucune fenêtre.
 */
export function getNextUncoveredOccurrenceDate(
  echeance: EcheanceRecurrente,
  coveredDates: Set<string>,
  refDate: Date = new Date(),
  horizonYearsBack = 2,
  horizonYearsForward = 6
): string | null {
  if (!echeance.isActive) return null;
  const y = refDate.getFullYear();
  const from = `${y - horizonYearsBack}-01`;
  const to = `${y + horizonYearsForward}-12`;
  let dates = uniqueSortedDates(computeOccurrences(echeance, from, to));
  let uncovered = dates.filter((d) => !coveredDates.has(d));
  if (uncovered.length === 0 && echeance.periodicite !== 'ONCE') {
    const toWide = `${y + 15}-12`;
    dates = uniqueSortedDates(computeOccurrences(echeance, from, toWide));
    uncovered = dates.filter((d) => !coveredDates.has(d));
  }
  return uncovered[0] ?? null;
}

/**
 * Même interface que getNextOccurrenceInfo mais basé sur les occurrences **non couvertes**.
 */
export function getNextUncoveredOccurrenceInfo(
  e: EcheanceRecurrente,
  coveredDates: Set<string>,
  refDate: Date = new Date()
): NextOccurrenceInfo | null {
  if (!e.isActive) {
    return {
      displayDate: '',
      nextDate: '',
      temporalStatus: 'desactive',
      daysFromToday: 0,
      message: 'Désactivée',
      isPast: false,
      isCovered: false,
    };
  }

  const today = ymdFromDate(startOfDay(refDate));
  const target = getNextUncoveredOccurrenceDate(e, coveredDates, refDate);

  if (!target) {
    if (e.periodicite === 'ONCE') {
      const from = `${refDate.getFullYear() - 5}-01`;
      const to = `${refDate.getFullYear() + 1}-12`;
      const dates = uniqueSortedDates(computeOccurrences(e, from, to));
      if (dates.length === 0) {
        return {
          displayDate: '',
          nextDate: '',
          temporalStatus: 'a_venir',
          daysFromToday: 0,
          message: 'Aucune occurrence',
          isPast: false,
          isCovered: false,
        };
      }
      if (dates.every((d) => coveredDates.has(d))) {
        return {
          displayDate: dates[dates.length - 1],
          nextDate: '',
          temporalStatus: 'a_venir',
          daysFromToday: 0,
          message: 'Occurrence couverte',
          isPast: false,
          isCovered: true,
        };
      }
    }
    return {
      displayDate: '',
      nextDate: '',
      temporalStatus: 'a_venir',
      daysFromToday: 0,
      message: 'Aucune occurrence à venir dans la fenêtre',
      isPast: false,
      isCovered: false,
    };
  }

  const days = daysBetween(today, target);
  const temporalStatus = temporalForTarget(target, today);
  return {
    displayDate: target,
    nextDate: target,
    temporalStatus,
    daysFromToday: temporalStatus === 'echue' ? daysBetween(target, today) : days,
    message: buildNextOccurrenceMessage(target, today, Math.abs(days)),
    isPast: temporalStatus === 'echue',
    isCovered: false,
  };
}

function scorePilotage(info: NextOccurrenceInfo | null): number {
  if (!info || info.temporalStatus === 'desactive') return 99999;
  if (info.temporalStatus === 'echue') return -10000 + info.daysFromToday;
  return info.daysFromToday;
}

/**
 * Échéance à mettre en avant : priorité aux occurrences passées non couvertes, sinon la plus proche à venir.
 */
export function pickPrimaryEcheanceForPilotage(
  echeances: EcheanceRecurrente[],
  coveredByEcheanceId: Map<string, Set<string>>,
  refDate: Date = new Date()
): { echeance: EcheanceRecurrente; info: NextOccurrenceInfo } | null {
  const active = echeances.filter((e) => e.isActive);
  if (active.length === 0) return null;
  let best: { echeance: EcheanceRecurrente; info: NextOccurrenceInfo; score: number } | null = null;
  for (const e of active) {
    const covered = coveredByEcheanceId.get(e.id) ?? new Set<string>();
    const info = getNextUncoveredOccurrenceInfo(e, covered, refDate);
    if (!info) continue;
    if (
      info.nextDate === '' &&
      (info.message === 'Aucune occurrence à venir dans la fenêtre' || info.message === 'Occurrence couverte')
    ) {
      continue;
    }
    const s = scorePilotage(info);
    if (!best || s < best.score) best = { echeance: e, info, score: s };
  }
  return best ? { echeance: best.echeance, info: best.info } : null;
}

/**
 * Nombre d'échéances actives ayant au moins une occurrence non couverte dans la fenêtre standard.
 */
export function countEcheancesWithUncoveredOccurrence(
  echeances: EcheanceRecurrente[],
  coveredByEcheanceId: Map<string, Set<string>>,
  refDate: Date = new Date()
): number {
  let n = 0;
  for (const e of echeances) {
    if (!e.isActive) continue;
    const covered = coveredByEcheanceId.get(e.id) ?? new Set<string>();
    const next = getNextUncoveredOccurrenceDate(e, covered, refDate);
    if (next != null) n++;
  }
  return n;
}

/** Liens dont la transaction couvre explicitement ou par date cette occurrence (YYYY-MM-DD). */
export function filterLinksForOccurrence(
  occurrenceYmd: string,
  links: LinkLike[],
  transactionDateById: Map<string, string>,
  dateToleranceDays: number
): LinkLike[] {
  return links.filter((link) => {
    if (link.occurrenceDate?.slice(0, 10) === occurrenceYmd) return true;
    const txYmd = (transactionDateById.get(link.transactionId) || '').slice(0, 10);
    if (!txYmd) return false;
    return daysBetween(txYmd, occurrenceYmd) <= dateToleranceDays;
  });
}
