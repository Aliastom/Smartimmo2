/**
 * Calculs dashboard page Biens : alertes, score de performance, KPIs pilotage, heatmap.
 * Utilisé côté frontend (mode normal et app-shell) sans modifier API ni modèle.
 */

import type { Transaction } from '@/features/analytics/types';

export type PropertyAlertType =
  | 'loyer_retard'
  | 'vacance'
  | 'bail_expire'
  | 'cashflow_negatif'
  | 'rentabilite_faible'
  | 'charges_elevees';

export interface PropertyAlert {
  propertyId: string;
  propertyName: string;
  type: PropertyAlertType;
  label: string;
  detail?: string;
}

export interface PropertyMetrics {
  propertyId: string;
  loyerMensuel: number;
  cashflowMensuel: number;
  rendementPct: number;
  score: number;
  scoreLabel: 'excellent' | 'tres_bon' | 'correct' | 'faible';
  alerts: PropertyAlert[];
}

export interface DashboardKpis {
  biensTotaux: number;
  rentabiliteMoyennePct: number;
  cashflowMensuelTotal: number;
  tauxVacancePct: number;
}

/** Valeur de référence pour "rentabilité faible" (seuil en %) */
const RENTABILITE_FAIBLE_SEUIL = 4;
/** Jours avant expiration du bail pour alerter */
const BAIL_EXPIRE_JOURS = 60;
/** Mois en cours : si pas de loyer reçu et bien occupé → retard possible */
const LOYER_RETARD_MOIS_SANS_RECETTE = 1;

/**
 * Calcule le cashflow mensuel moyen sur les 12 derniers mois pour un bien.
 */
export function computePropertyCashflow(
  propertyId: string,
  transactions: Transaction[],
  months: number = 12
): number {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - months, 1);
  const byProperty = transactions.filter(
    (t) => t.propertyId === propertyId && new Date(t.date) >= cutoff
  );
  const income = byProperty.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = byProperty.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
  return (income - expense) / months;
}

/**
 * Calcule la rentabilité brute (loyer annuel / valeur du bien * 100).
 */
export function computeRentability(
  loyerMensuel: number,
  value: number
): number {
  if (!value || value <= 0) return 0;
  return (loyerMensuel * 12 / value) * 100;
}

/**
 * Score 0–100 : occupation (40) + rentabilité (30) + cashflow (20) + stabilité paiement (10).
 * Formule simplifiée : pas de détail des retards, on utilise cashflow et occupation comme proxy.
 */
export function computePropertyScore(
  loyerMensuel: number,
  rendementPct: number,
  cashflowMensuel: number,
  isOccupied: boolean
): { score: number; label: PropertyMetrics['scoreLabel'] } {
  let occupation = 0;
  if (isOccupied) occupation = 40;
  else occupation = 0;

  const rentabilite = Math.min(30, Math.max(0, (rendementPct / 10) * 30));
  const cashflow = cashflowMensuel >= 0
    ? Math.min(20, (cashflowMensuel / 500) * 20)
    : 0;
  const stabilite = cashflowMensuel >= 0 ? 10 : 0;

  const score = Math.round(Math.min(100, Math.max(0, occupation + rentabilite + cashflow + stabilite)));

  let label: PropertyMetrics['scoreLabel'] = 'faible';
  if (score >= 90) label = 'excellent';
  else if (score >= 70) label = 'tres_bon';
  else if (score >= 50) label = 'correct';

  return { score, label };
}

/** Indicateur discret (pas de fond coloré) : Cashflow */
export function getCashflowIndicator(cashflow: number): '🟢' | '🟡' | '🔴' {
  if (cashflow >= 200) return '🟢';
  if (cashflow >= 0) return '🟡';
  return '🔴';
}

/** Indicateur discret : Rendement (🟢 bon, 🟡 moyen, 🟠 faible — pas de rouge pour limiter l'effet négatif) */
export function getRendementIndicator(pct: number): '🟢' | '🟡' | '🟠' | null {
  if (pct <= 0) return null;
  if (pct >= 7) return '🟢';
  if (pct >= 5) return '🟡';
  return '🟠';
}

/** Libellés courts pour le regroupement d'alertes */
export const ALERT_TYPE_LABELS: Record<PropertyAlertType, string> = {
  loyer_retard: 'Loyers en retard',
  vacance: 'Vacances locatives',
  bail_expire: 'Baux proches d\'expiration',
  cashflow_negatif: 'Cashflows négatifs',
  rentabilite_faible: 'Rentabilités faibles',
  charges_elevees: 'Charges élevées',
};

export interface GroupedAlertsSummary {
  type: PropertyAlertType;
  label: string;
  count: number;
  alerts: PropertyAlert[];
}

/** Regroupe les alertes par type pour affichage résumé. */
export function groupAlertsByType(alerts: PropertyAlert[]): GroupedAlertsSummary[] {
  const byType = new Map<PropertyAlertType, PropertyAlert[]>();
  for (const a of alerts) {
    const list = byType.get(a.type) ?? [];
    list.push(a);
    byType.set(a.type, list);
  }
  const order: PropertyAlertType[] = ['loyer_retard', 'bail_expire', 'cashflow_negatif', 'rentabilite_faible', 'vacance', 'charges_elevees'];
  return order
    .filter((type) => (byType.get(type)?.length ?? 0) > 0)
    .map((type) => ({
      type,
      label: ALERT_TYPE_LABELS[type],
      count: byType.get(type)!.length,
      alerts: byType.get(type)!,
    }));
}

/**
 * Couleur du badge score (90+ vert, 70–89 vert clair, 50–69 orange, <50 rouge).
 */
export function getScoreBadgeClass(score: number): string {
  if (score >= 90) return 'bg-emerald-600 text-white';
  if (score >= 70) return 'bg-emerald-500/90 text-white';
  if (score >= 50) return 'bg-amber-500 text-white';
  return 'bg-red-500 text-white';
}

/** Couleur du point score (affichage compact minimal). */
export function getScoreDotColor(score: number): string {
  if (score >= 90) return 'text-emerald-600';
  if (score >= 70) return 'text-emerald-500';
  if (score >= 50) return 'text-amber-500';
  return 'text-red-500';
}

export function getScoreLabelText(label: PropertyMetrics['scoreLabel']): string {
  const map: Record<PropertyMetrics['scoreLabel'], string> = {
    excellent: 'Excellent',
    tres_bon: 'Très bon',
    correct: 'Correct',
    faible: 'Faible',
  };
  return map[label] ?? 'Faible';
}

/** Couleur par niveau pour la mini heatmap santé */
export type HealthLevel = 'green' | 'orange' | 'red';

/** Mini heatmap santé : [rentabilité, cashflow, occupation, alertes] — vert = bon, orange = moyen, rouge = problème */
export function getHealthHeatmap(metrics: PropertyMetrics | undefined, isOccupied: boolean): HealthLevel[] {
  if (!metrics) return ['red', 'red', 'red', 'red'];
  const rent = metrics.rendementPct >= 7 ? 'green' : metrics.rendementPct >= 5 ? 'orange' : 'red';
  const cf = metrics.cashflowMensuel >= 200 ? 'green' : metrics.cashflowMensuel >= 0 ? 'orange' : 'red';
  const occ = isOccupied ? 'green' : 'red';
  const al = (metrics.alerts?.length ?? 0) === 0 ? 'green' : (metrics.alerts?.length ?? 0) <= 2 ? 'orange' : 'red';
  return [rent, cf, occ, al];
}

/** Priorité pour le tri intelligent : 0 = avec alertes, 1 = cashflow négatif, 2 = vacance, 3 = autres */
export function getPropertySortPriority(
  propertyId: string,
  metrics: PropertyMetrics | undefined,
  isOccupied: boolean
): number {
  if (!metrics) return 3;
  if ((metrics.alerts?.length ?? 0) > 0) return 0;
  if (metrics.cashflowMensuel < 0) return 1;
  if (!isOccupied) return 2;
  return 3;
}

/**
 * Génère les alertes pour un bien (loyer retard, vacance, bail expire, cashflow négatif, rentabilité faible).
 */
export function getAlertsForProperty(
  propertyId: string,
  propertyName: string,
  isOccupied: boolean,
  loyerMensuel: number,
  endDate: string | null | undefined,
  cashflowMensuel: number,
  rendementPct: number,
  hasRentThisMonth: boolean
): PropertyAlert[] {
  const alerts: PropertyAlert[] = [];
  const now = new Date();

  if (!isOccupied && loyerMensuel > 0) {
    alerts.push({
      propertyId,
      propertyName,
      type: 'vacance',
      label: 'Vacance locative',
    });
  }

  if (endDate) {
    const end = new Date(endDate);
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= BAIL_EXPIRE_JOURS && daysLeft > 0) {
      alerts.push({
        propertyId,
        propertyName,
        type: 'bail_expire',
        label: `Bail expire dans ${daysLeft} jours`,
        detail: end.toLocaleDateString('fr-FR'),
      });
    }
  }

  if (isOccupied && loyerMensuel > 0 && !hasRentThisMonth) {
    alerts.push({
      propertyId,
      propertyName,
      type: 'loyer_retard',
      label: 'Loyer en retard',
    });
  }

  if (cashflowMensuel < 0) {
    alerts.push({
      propertyId,
      propertyName,
      type: 'cashflow_negatif',
      label: 'Cashflow négatif',
      detail: `${cashflowMensuel.toFixed(0)} €/mois`,
    });
  }

  if (rendementPct > 0 && rendementPct < RENTABILITE_FAIBLE_SEUIL) {
    alerts.push({
      propertyId,
      propertyName,
      type: 'rentabilite_faible',
      label: 'Rentabilité faible',
      detail: `${rendementPct.toFixed(1)} %`,
    });
  }

  return alerts;
}

/**
 * Construit les métriques par bien et la liste d'alertes globales pour le bloc "Actions à traiter".
 */
export function computePropertiesDashboard(
  properties: Array<{
    id: string;
    name: string;
    currentValue?: number | null;
    acquisitionPrice?: number | null;
    isArchived?: boolean;
    Lease?: Array<{
      rentAmount: number;
      endDate?: string | null;
    }>;
  }>,
  transactions: Transaction[]
): {
  metricsByProperty: Map<string, PropertyMetrics>;
  alerts: PropertyAlert[];
  kpis: DashboardKpis;
} {
  const metricsByProperty = new Map<string, PropertyMetrics>();
  const allAlerts: PropertyAlert[] = [];
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalRentabilite = 0;
  let countRentabilite = 0;
  let cashflowTotal = 0;
  let occupiedCount = 0;

  for (const prop of properties) {
    if (prop.isArchived) continue;

    const lease = prop.Lease?.[0];
    const loyerMensuel = lease?.rentAmount ?? 0;
    const isOccupied = !!(lease && (prop.Lease?.length ?? 0) > 0);
    if (isOccupied) occupiedCount++;

    const value = (prop.currentValue ?? prop.acquisitionPrice) || 0;
    const rendementPct = computeRentability(loyerMensuel, value);
    if (loyerMensuel > 0 && value > 0) {
      totalRentabilite += rendementPct;
      countRentabilite += 1;
    }

    const cashflowMensuel = computePropertyCashflow(prop.id, transactions);
    cashflowTotal += cashflowMensuel;

    const hasRentThisMonth = transactions.some(
      (t) =>
        t.propertyId === prop.id &&
        t.kind === 'income' &&
        new Date(t.date) >= currentMonthStart
    );

    const alerts = getAlertsForProperty(
      prop.id,
      prop.name,
      isOccupied,
      loyerMensuel,
      lease?.endDate ?? null,
      cashflowMensuel,
      rendementPct,
      hasRentThisMonth
    );
    allAlerts.push(...alerts);

    const { score, label } = computePropertyScore(
      loyerMensuel,
      rendementPct,
      cashflowMensuel,
      isOccupied
    );

    metricsByProperty.set(prop.id, {
      propertyId: prop.id,
      loyerMensuel,
      cashflowMensuel,
      rendementPct,
      score,
      scoreLabel: label,
      alerts,
    });
  }

  const total = properties.filter((p) => !p.isArchived).length;
  const rentabiliteMoyennePct = countRentabilite > 0 ? totalRentabilite / countRentabilite : 0;
  const tauxVacancePct = total > 0 ? ((total - occupiedCount) / total) * 100 : 0;

  const kpis: DashboardKpis = {
    biensTotaux: total,
    rentabiliteMoyennePct,
    cashflowMensuelTotal: Math.round(cashflowTotal * 100) / 100,
    tauxVacancePct: Math.round(tauxVacancePct * 10) / 10,
  };

  return {
    metricsByProperty,
    alerts: allAlerts.sort((a, b) => {
      const order: Record<PropertyAlertType, number> = {
        loyer_retard: 0,
        bail_expire: 1,
        cashflow_negatif: 2,
        rentabilite_faible: 3,
        vacance: 4,
        charges_elevees: 5,
      };
      return (order[a.type] ?? 9) - (order[b.type] ?? 9);
    }),
    kpis,
  };
}
