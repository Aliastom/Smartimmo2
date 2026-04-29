/**
 * Lignes de traçabilité affichées sous la recommandation Patrimoine (cockpit).
 */

import { formatCurrencyEUR } from '@/utils/format';
import type { PatrimoineSnapshotResult } from '@/features/patrimoine/hooks/usePatrimoineSnapshot';

export interface PatrimoineRecommendationTraceRow {
  label: string;
  value: string;
  source: string;
}

function formatMarketModuleSource(snapshot: PatrimoineSnapshotResult): string {
  if (snapshot.availableMarketInvestments.length === 0) {
    return 'Module Marché';
  }
  const mode = snapshot.marketInvestmentSelectionMode ?? 'AUTO';
  if (mode === 'MANUAL') {
    return 'Module Marché · Choisi';
  }
  return 'Module Marché · Auto';
}

function formatMarketAthLine(snapshot: PatrimoineSnapshotResult): string {
  if (!snapshot.hasMarketData) {
    return 'Non disponible';
  }
  const dd = snapshot.drawdownPercent;
  if (dd != null && Number.isFinite(dd)) {
    const sign = dd > 0 ? '+' : '';
    return `${sign}${dd.toFixed(1)} % de l’ATH`;
  }
  const ath = snapshot.athDistancePercent;
  if (ath != null && Number.isFinite(ath)) {
    return `${ath.toFixed(1)} % sous l’ATH`;
  }
  return 'Indicateurs limités';
}

function formatFiscalLine(snapshot: PatrimoineSnapshotResult): string {
  if (!snapshot.hasFiscalSimulation) {
    return 'Non reliée';
  }
  const net = snapshot.revenuLocatifNet;
  if (!Number.isFinite(net)) {
    return '—';
  }
  const mode = snapshot.fiscalSimulationSelectionMode ?? 'AUTO';
  const sourceTag =
    mode === 'AUTO'
      ? 'Simulation fiscale · Auto'
      : mode === 'MANUAL'
        ? 'Simulation fiscale · Choisie'
        : 'Simulation fiscale · Fallback';
  return `${formatCurrencyEUR(net)} / an net — ${sourceTag}`;
}

function formatInvestableLine(amount: number): string {
  if (!Number.isFinite(amount)) {
    return '—';
  }
  return formatCurrencyEUR(Math.max(0, amount));
}

function formatAllocationEtfPercent(allocationEtf: number): string {
  if (!Number.isFinite(allocationEtf)) {
    return '0 %';
  }
  const clamped = Math.max(0, Math.min(1, allocationEtf));
  return `${Math.round(clamped * 100)} %`;
}

/**
 * Jusqu’à 4 lignes synthétiques pour expliquer les entrées de la reco.
 */
export function buildPatrimoineRecommendationTrace(snapshot: PatrimoineSnapshotResult): PatrimoineRecommendationTraceRow[] {
  return [
    {
      label: 'Cash investissable',
      value: formatInvestableLine(snapshot.investableCash),
      source: 'Paramètres patrimoine',
    },
    {
      label: 'Marché',
      value: formatMarketAthLine(snapshot),
      source: formatMarketModuleSource(snapshot),
    },
    {
      label: 'Fiscalité',
      value: formatFiscalLine(snapshot),
      source: 'Simulation fiscale',
    },
    {
      label: 'Allocation ETF',
      value: formatAllocationEtfPercent(snapshot.allocationEtf),
      source: 'Patrimoine',
    },
  ];
}
