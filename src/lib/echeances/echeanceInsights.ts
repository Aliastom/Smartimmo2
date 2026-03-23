/**
 * Pilotage intelligent du patrimoine (phase 4).
 * KPI qualité, alertes, suggestions proactives, prévisionnel vs réel.
 */

import type { EcheanceStatutGeneration } from '@/types/echeance';
import type { EcheanceRecurrente } from '@/types/echeance';
import type { CoverageResult } from '@/lib/echeances/echeanceCoverage';
import { getNextOccurrenceInfo } from '@/lib/echeances/echeanceCashflowHelpers';
import { sumProjected12Months } from '@/lib/echeances/echeanceCashflowHelpers';

export type QualityColor = 'green' | 'orange' | 'red';

export interface QualityScoreResult {
  scorePercent: number;
  color: QualityColor;
  /** Nombre d'échéances prises en compte (actives ou avec couverture) */
  count: number;
}

/** Poids par statut pour le calcul qualité : GENEREE=1, PARTIELLE/montant_superieur=0.5, A_GENERER=0 */
const QUALITY_WEIGHT: Record<EcheanceStatutGeneration, number> = {
  generee: 1,
  partielle: 0.5,
  montant_superieur: 0.5,
  a_generer: 0,
};

/**
 * Calcule le score "Qualité de suivi" : % d'échéances bien couvertes.
 * Vert > 80 %, orange 50–80 %, rouge < 50 %.
 */
export function computeQualityScore(
  items: { statut: EcheanceStatutGeneration }[]
): QualityScoreResult {
  const count = items.length;
  if (count === 0) {
    return { scorePercent: 0, color: 'red', count: 0 };
  }
  const sum = items.reduce((acc, i) => acc + (QUALITY_WEIGHT[i.statut] ?? 0), 0);
  const scorePercent = Math.round((sum / count) * 100);
  let color: QualityColor = 'red';
  if (scorePercent > 80) color = 'green';
  else if (scorePercent >= 50) color = 'orange';
  return { scorePercent, color, count };
}

export interface EcheanceWithCoverage {
  id: string;
  type: string;
  label: string;
  montant: number;
  sens: string;
  isActive: boolean;
  /** Date prochaine occurrence (YYYY-MM-DD) */
  nextOccurrenceDate?: string | null;
  coverage?: CoverageResult;
  /** Nombre de transactions liées */
  linkedCount: number;
}

export type AlertKind = 'echue_non_generee' | 'ecart_important' | 'absence_recurrente';

export interface EcheanceAlert {
  kind: AlertKind;
  label: string;
  count?: number;
  echeanceIds?: string[];
  /** Montant ou détail optionnel */
  detail?: string;
}

/**
 * Alertes simples : échéance passée non générée, écart important, absence de récurrente.
 */
export function computeAlerts(
  echeances: EcheanceWithCoverage[],
  refDate: Date = new Date()
): EcheanceAlert[] {
  const alerts: EcheanceAlert[] = [];
  const today = refDate.toISOString().slice(0, 10);

  const echuesSansTx = echeances.filter(
    (e) =>
      e.isActive &&
      e.nextOccurrenceDate &&
      e.nextOccurrenceDate < today &&
      (e.linkedCount === 0 || e.coverage?.statut === 'a_generer')
  );
  if (echuesSansTx.length > 0) {
    alerts.push({
      kind: 'echue_non_generee',
      label: `${echuesSansTx.length} échéance${echuesSansTx.length > 1 ? 's' : ''} passée${echuesSansTx.length > 1 ? 's' : ''} sans transaction`,
      count: echuesSansTx.length,
      echeanceIds: echuesSansTx.map((e) => e.id),
    });
  }

  const ecartImportant = echeances.filter(
    (e) =>
      e.coverage &&
      (e.coverage.statut === 'partielle' || e.coverage.statut === 'montant_superieur') &&
      Math.abs(e.coverage.ecartAbsolu) > 50
  );
  if (ecartImportant.length > 0) {
    const maxEcart = Math.max(...ecartImportant.map((e) => Math.abs(e.coverage!.ecartAbsolu)));
    alerts.push({
      kind: 'ecart_important',
      label: `${ecartImportant.length} échéance${ecartImportant.length > 1 ? 's' : ''} avec écart > 50 €`,
      count: ecartImportant.length,
      detail: `Écart max ${maxEcart} €`,
      echeanceIds: ecartImportant.map((e) => e.id),
    });
  }

  return alerts;
}

export interface ProactiveSuggestion {
  id: string;
  label: string;
  action: 'create_transaction' | 'link_transaction' | 'check_ecart';
  echeanceId?: string;
  transactionId?: string;
  detail?: string;
}

/**
 * Suggestions d'actions : créer transaction, lier, vérifier écart.
 */
export function computeSuggestions(
  echeances: EcheanceWithCoverage[],
  refDate: Date = new Date()
): ProactiveSuggestion[] {
  const suggestions: ProactiveSuggestion[] = [];
  const today = refDate.toISOString().slice(0, 10);

  for (const e of echeances) {
    if (!e.isActive) continue;
    if (e.nextOccurrenceDate && e.nextOccurrenceDate <= today && e.coverage?.statut === 'a_generer') {
      suggestions.push({
        id: `create-${e.id}`,
        label: `Créer la transaction pour ${e.label}`,
        action: 'create_transaction',
        echeanceId: e.id,
        detail: e.label,
      });
    }
    if (e.coverage && (e.coverage.statut === 'partielle' || e.coverage.statut === 'montant_superieur') && Math.abs(e.coverage.ecartAbsolu) > 2) {
      suggestions.push({
        id: `check-${e.id}`,
        label: `Vérifier l'écart de ${Math.round(e.coverage.ecartAbsolu)} € — ${e.label}`,
        action: 'check_ecart',
        echeanceId: e.id,
        detail: `Écart ${e.coverage.ecartAbsolu} €`,
      });
    }
  }

  return suggestions.slice(0, 5);
}

export interface ForecastDeltaResult {
  chargesForecast12M: number;
  revenusForecast12M: number;
  /** Réel = somme des transactions sur la période (à fournir côté appelant) */
  chargesReal12M?: number;
  revenusReal12M?: number;
  deltaCharges?: number;
  deltaRevenus?: number;
}

/**
 * Prévisionnel 12 mois (déjà dans sumProjected12Months) + optionnel réel pour écart.
 * computeForecastDelta retourne les totaux prévisionnels ; le réel doit être calculé côté appelant (transactions).
 */
export function computeForecastTotals(
  echeances: EcheanceRecurrente[],
  refDate: Date = new Date()
): { chargesTotal: number; revenusTotal: number } {
  return sumProjected12Months(echeances, refDate);
}

/**
 * Écart prévisionnel vs réel (si totaux réels fournis).
 */
export function computeDelta(
  forecastCharges: number,
  forecastRevenus: number,
  realCharges: number,
  realRevenus: number
): { deltaCharges: number; deltaRevenus: number } {
  return {
    deltaCharges: realCharges - forecastCharges,
    deltaRevenus: realRevenus - forecastRevenus,
  };
}

/**
 * Score global de gestion du bien (0–100) basé sur couverture, régularité, écarts.
 * Simplifié : même logique que qualité de suivi, étendu aux échéances actives.
 */
export function computePropertyManagementScore(
  echeancesWithCoverage: { statut: EcheanceStatutGeneration; isActive?: boolean }[]
): { score: number; color: QualityColor } {
  const active = echeancesWithCoverage.filter((e) => e.isActive !== false);
  if (active.length === 0) return { score: 0, color: 'red' };
  const { scorePercent, color } = computeQualityScore(active);
  return { score: scorePercent, color };
}
