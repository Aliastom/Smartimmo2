/**
 * Synthèse intelligente pour le dashboard — format engageant
 * Retourne un objet structuré pour affichage avec icône dynamique et lignes.
 */

import type { MonthlyKPIs } from '@/types/dashboard';
import type { LoyerNonEncaisse } from '@/types/dashboard';

export type SummaryType = 'critical' | 'warning' | 'sain';

export interface DashboardSummaryStructured {
  type: SummaryType;
  /** Nom d'icône (AlertTriangle, CheckCircle2, etc.) */
  icon: 'AlertTriangle' | 'AlertCircle' | 'CheckCircle2';
  /** Lignes à afficher (chaque ligne peut être animée word-by-word) */
  lines: string[];
}

export function buildDashboardSummary(params: {
  kpis: MonthlyKPIs;
  relances: LoyerNonEncaisse[];
  currentMonthLabel: string;
}): DashboardSummaryStructured {
  const { kpis, relances, currentMonthLabel } = params;
  const lines: string[] = [];

  const taux = kpis.tauxEncaissement;
  const hasRentData = kpis.loyersAttendus > 0;

  if (hasRentData) {
    if (taux >= 100) {
      lines.push('Tous les loyers sont encaissés.');
    } else if (taux >= 80) {
      lines.push(`${Math.round(taux)} % des loyers encaissés.`);
    } else {
      lines.push(`${Math.round(taux)} % des loyers encaissés.`);
    }
  }

  if (relances.length > 0) {
    lines.push(`${relances.length} relance${relances.length > 1 ? 's' : ''} à effectuer.`);
  }

  if (kpis.deltaCashflow !== 0) {
    if (kpis.deltaCashflow > 0) {
      lines.push('Cashflow en hausse par rapport au mois précédent.');
    } else {
      const pct = kpis.deltaCashflow && kpis.cashflow - kpis.deltaCashflow !== 0
        ? Math.round((Math.abs(kpis.deltaCashflow) / (kpis.cashflow - kpis.deltaCashflow)) * 100)
        : 0;
      lines.push(pct > 0 ? `Cashflow en baisse de ${pct} %.` : 'Cashflow en baisse par rapport au mois précédent.');
    }
  }

  if (lines.length === 0 && hasRentData) {
    return {
      type: 'sain',
      icon: 'CheckCircle2',
      lines: ['Tous les indicateurs sont au vert.', 'Aucune action urgente ce mois-ci.'],
    };
  }

  if (lines.length === 0) {
    return {
      type: 'sain',
      icon: 'CheckCircle2',
      lines: [`Aucune donnée critique pour ${currentMonthLabel}.`],
    };
  }

  const isCritical = relances.length > 0 || kpis.cashflow < 0 || taux < 70;
  const isWarning = taux < 80 || kpis.deltaCashflow < 0;

  return {
    type: isCritical ? 'critical' : isWarning ? 'warning' : 'sain',
    icon: isCritical ? 'AlertTriangle' : isWarning ? 'AlertCircle' : 'CheckCircle2',
    lines,
  };
}

/** Ancienne API : retourne une seule chaîne (rétrocompat) */
export function buildDashboardSummaryLegacy(params: {
  kpis: MonthlyKPIs;
  relances: LoyerNonEncaisse[];
  currentMonthLabel: string;
}): string {
  const s = buildDashboardSummary(params);
  return s.lines.join(' ');
}
