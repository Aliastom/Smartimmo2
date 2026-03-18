/**
 * Helpers cashflow / pilotage pour les échéances récurrentes.
 * Philosophie prévisionnelle : l’échéance est une règle de projection, pas une facture à payer.
 * Statut temporel = À venir / Échue / Désactivée. Statut génération = Générée / À générer (selon transactions liées).
 */

import type { EcheanceRecurrente, EcheanceStatutTemporel, EcheanceStatutGeneration } from '@/types/echeance';
import { expandEcheances, type EcheanceRecurrenteInput } from '@/lib/echeances/expandEcheances';

function toInput(e: EcheanceRecurrente): EcheanceRecurrenteInput {
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

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(a: string, b: string): number {
  const t0 = new Date(a + 'T12:00:00').getTime();
  const t1 = new Date(b + 'T12:00:00').getTime();
  return Math.round((t1 - t0) / (24 * 60 * 60 * 1000));
}

export interface NextOccurrenceInfo {
  /** Date affichée (prochaine occurrence ou dernière échue) */
  displayDate: string;
  /** Prochaine occurrence calendaire (YYYY-MM-DD) */
  nextDate: string;
  /** Statut temporel : À venir / Échue / Désactivée (pas de notion "retard" paiement) */
  temporalStatus: EcheanceStatutTemporel;
  daysFromToday: number;
  /** Message affiché : "À venir dans X mois", "Échéance passée", "Prochaine occurrence aujourd'hui", etc. */
  message: string;
}

const SOON_DAYS = 7;

/**
 * Prochaine occurrence + état d'urgence pour une échéance active.
 */
export function getNextOccurrenceInfo(
  e: EcheanceRecurrente,
  refDate: Date = new Date()
): NextOccurrenceInfo | null {
  if (!e.isActive) {
    return {
      displayDate: '',
      nextDate: '',
      temporalStatus: 'desactive',
      daysFromToday: 0,
      message: 'Désactivée',
    };
  }

  const today = ymd(startOfDay(refDate));
  const from = `${refDate.getFullYear() - 1}-01`;
  const to = `${refDate.getFullYear() + 3}-12`;

  const occ = expandEcheances([toInput(e)], from, to);
  const dates = [...new Set(occ.map((o) => o.date))].sort();

  const nextOnOrAfter = dates.find((d) => d >= today);
  const lastBefore = [...dates].filter((d) => d < today).pop();

  if (!nextOnOrAfter && !lastBefore) {
    return null;
  }

  if (nextOnOrAfter === today) {
    return {
      displayDate: nextOnOrAfter,
      nextDate: nextOnOrAfter,
      temporalStatus: 'a_venir',
      daysFromToday: 0,
      message: 'Prochaine occurrence aujourd\'hui',
    };
  }

  if (nextOnOrAfter && nextOnOrAfter > today) {
    const d = daysBetween(today, nextOnOrAfter);
    if (d <= SOON_DAYS) {
      return {
        displayDate: nextOnOrAfter,
        nextDate: nextOnOrAfter,
        temporalStatus: 'a_venir',
        daysFromToday: d,
        message: `À venir dans ${d} jour${d > 1 ? 's' : ''}`,
      };
    }
    if (d < 35) {
      return {
        displayDate: nextOnOrAfter,
        nextDate: nextOnOrAfter,
        temporalStatus: 'a_venir',
        daysFromToday: d,
        message: `À venir dans ${d} jours`,
      };
    }
    const months = Math.round(d / 30);
    return {
      displayDate: nextOnOrAfter,
      nextDate: nextOnOrAfter,
      temporalStatus: 'a_venir',
      daysFromToday: d,
      message: months >= 1 ? `À venir dans environ ${months} mois` : `À venir dans ${d} jours`,
    };
  }

  if (lastBefore && lastBefore < today) {
    return {
      displayDate: lastBefore,
      nextDate: lastBefore,
      temporalStatus: 'echue',
      daysFromToday: daysBetween(today, lastBefore),
      message: 'Échéance passée',
    };
  }

  return null;
}

export interface ProjectedTotals12M {
  chargesTotal: number;
  revenusTotal: number;
}

export function sumProjected12Months(
  echeances: EcheanceRecurrente[],
  refDate: Date = new Date()
): ProjectedTotals12M {
  const y = refDate.getFullYear();
  const m = refDate.getMonth() + 1;
  const from = `${y}-${String(m).padStart(2, '0')}`;
  const end = new Date(refDate);
  end.setMonth(end.getMonth() + 12);
  const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}`;

  const inputs = echeances.filter((e) => e.isActive).map(toInput);
  const occ = expandEcheances(inputs, from, to);

  let chargesTotal = 0;
  let revenusTotal = 0;
  for (const o of occ) {
    if (o.sens === 'DEBIT') chargesTotal += Math.abs(o.amount);
    else revenusTotal += Math.abs(o.amount);
  }

  return { chargesTotal, revenusTotal };
}

function scorePrimary(e: EcheanceRecurrente, info: NextOccurrenceInfo | null): number {
  if (!info || info.temporalStatus === 'desactive') return 99999;
  if (info.temporalStatus === 'echue') return -10000;
  return info.daysFromToday;
}

/** Échéance à mettre en avant (échue sans transaction > à venir la plus proche) */
export function pickPrimaryEcheance(
  echeances: EcheanceRecurrente[],
  refDate: Date = new Date()
): { echeance: EcheanceRecurrente; info: NextOccurrenceInfo } | null {
  const active = echeances.filter((e) => e.isActive);
  if (active.length === 0) return null;
  let best: { echeance: EcheanceRecurrente; info: NextOccurrenceInfo; score: number } | null = null;
  for (const e of active) {
    const info = getNextOccurrenceInfo(e, refDate);
    if (!info) continue;
    const s = scorePrimary(e, info);
    if (!best || s < best.score) best = { echeance: e, info, score: s };
  }
  return best ? { echeance: best.echeance, info: best.info } : null;
}

/** Nombre d’échéances actives dont la prochaine occurrence est passée (échues). Utilisé pour KPI "À générer" quand aucune transaction n’est liée. */
export function countEcheancesEchues(echeances: EcheanceRecurrente[], refDate: Date = new Date()): number {
  let n = 0;
  for (const e of echeances) {
    if (!e.isActive) continue;
    const info = getNextOccurrenceInfo(e, refDate);
    if (info?.temporalStatus === 'echue') n++;
  }
  return n;
}

/** Pour compatibilité temporaire : alias vers countEcheancesEchues (plus de notion "en retard"). */
export const countOverdueEcheances = countEcheancesEchues;

/** Badge pour le statut temporel (À venir / Échue / Désactivée). */
export function temporalBadgeMeta(t: EcheanceStatutTemporel): { emoji: string; label: string; className: string } {
  switch (t) {
    case 'desactive':
      return { emoji: '⚪', label: 'Désactivée', className: 'bg-gray-100 text-gray-600 border-gray-200' };
    case 'echue':
      return { emoji: '🟠', label: 'Échue', className: 'bg-amber-50 text-amber-900 border-amber-200' };
    case 'a_venir':
    default:
      return { emoji: '🔵', label: 'À venir', className: 'bg-blue-50 text-blue-800 border-blue-100' };
  }
}

/** Options pour le badge montant_superieur : rouge si dépassement très important (≥ overRatioCritical). */
export function generationBadgeMeta(
  g: EcheanceStatutGeneration,
  opts?: { overRatio?: number; overRatioCritical?: number }
): { emoji: string; label: string; className: string } {
  const critical = opts?.overRatioCritical ?? 2;
  switch (g) {
    case 'generee':
      return { emoji: '✅', label: 'Générée', className: 'bg-emerald-50 text-emerald-800 border-emerald-100' };
    case 'partielle':
      return { emoji: '🟡', label: 'Partielle', className: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'montant_superieur':
      return opts?.overRatio != null && opts.overRatio >= critical
        ? { emoji: '⚠️', label: 'Montant supérieur', className: 'bg-red-50 text-red-800 border-red-200' }
        : { emoji: '⚠️', label: 'Montant supérieur', className: 'bg-orange-50 text-orange-800 border-orange-200' };
    case 'a_generer':
    default:
      return { emoji: '📋', label: 'À générer', className: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
}

/** Statut de génération : si coverage fourni, utilise son statut ; sinon fallback 0 = à générer, 1+ = générée. */
export function getStatutGeneration(
  linkedCount: number,
  coverage?: { statut: EcheanceStatutGeneration }
): EcheanceStatutGeneration {
  if (coverage) return coverage.statut;
  if (linkedCount >= 1) return 'generee';
  return 'a_generer';
}
