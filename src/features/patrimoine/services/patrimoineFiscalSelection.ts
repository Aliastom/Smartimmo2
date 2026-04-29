/**
 * Sélection de la simulation fiscale utilisée par le cockpit Patrimoine (plusieurs sauvegardes possibles).
 */

import type { LocalFiscalSimulation } from '@/lib/offline/db';
import type { FiscalInputs } from '@/types/fiscal';
import type { SimulationResult } from '@/types/fiscal';
import { formatCurrencyEUR } from '@/utils/format';

export type FiscalSimulationSelectionMode = 'AUTO' | 'MANUAL' | 'MISSING_FALLBACK';

export interface PatrimoineAvailableFiscalSimulation {
  id: string;
  label: string;
  fiscalYear: number;
  createdAt: string;
  updatedAt: string;
  netLocatifApresImpots: number | null;
  resteAPayer: number | null;
  isValidated: boolean;
}

export function parseSimulationResult(row: LocalFiscalSimulation): SimulationResult | null {
  try {
    const r = JSON.parse(row.resultJson) as SimulationResult;
    if (!r || typeof r !== 'object' || !('resume' in r)) return null;
    return r;
  } catch {
    return null;
  }
}

export function parseFiscalInputs(row: LocalFiscalSimulation): FiscalInputs | null {
  try {
    return JSON.parse(row.inputsJson) as FiscalInputs;
  } catch {
    return null;
  }
}

/** Dernière simulation « valide » : résultat exploitable (résumé présent), tri updatedAt desc (comportement historique cockpit). */
export function pickLatestUsableFiscalSimulation(rows: LocalFiscalSimulation[]): LocalFiscalSimulation | null {
  const usable = rows
    .map((row) => ({ row, result: parseSimulationResult(row) }))
    .filter((x): x is { row: LocalFiscalSimulation; result: SimulationResult } => x.result !== null);
  if (usable.length === 0) return null;
  usable.sort((a, b) => new Date(b.row.updatedAt).getTime() - new Date(a.row.updatedAt).getTime());
  return usable[0].row;
}

function computeResteAPayer(row: LocalFiscalSimulation, result: SimulationResult): number | null {
  const fiscalInputs = parseFiscalInputs(row);
  const totalImpots =
    result.resume?.totalImpots ??
    (Number(result.ir?.impotNet ?? 0) + Number(result.ps?.montant ?? 0));
  const paid =
    Number(fiscalInputs?.options?.acomptesDejaPayes ?? 0) +
    Number(fiscalInputs?.options?.prelevementSourceDejaPaye ?? 0);
  const reste = Math.max(0, Math.round((totalImpots - paid) * 100) / 100);
  return Number.isFinite(reste) ? reste : null;
}

function netLocatifFromResult(result: SimulationResult): number | null {
  const raw =
    result.resume?.beneficeNetImmobilier != null && Number.isFinite(result.resume.beneficeNetImmobilier)
      ? result.resume.beneficeNetImmobilier
      : result.cashflow?.cashflowNet != null && Number.isFinite(result.cashflow.cashflowNet)
        ? result.cashflow.cashflowNet
        : null;
  if (raw == null || !Number.isFinite(raw)) return null;
  return raw >= 0 ? raw : 0;
}

export function buildSimulationRowLabel(item: PatrimoineAvailableFiscalSimulation): string {
  const parts: string[] = [`${item.fiscalYear}`];
  parts.push(item.isValidated ? 'validée' : 'incomplète');
  if (item.netLocatifApresImpots != null && Number.isFinite(item.netLocatifApresImpots)) {
    parts.push(`net ${formatCurrencyEUR(item.netLocatifApresImpots)}`);
  }
  if (item.resteAPayer != null && Number.isFinite(item.resteAPayer)) {
    parts.push(`reste ${formatCurrencyEUR(item.resteAPayer)}`);
  }
  return parts.join(' · ');
}

export function buildAvailableFiscalSimulations(rows: LocalFiscalSimulation[]): PatrimoineAvailableFiscalSimulation[] {
  const enriched = rows.map((row) => {
    const result = parseSimulationResult(row);
    const isValidated = result !== null;
    const netLocatifApresImpots = result ? netLocatifFromResult(result) : null;
    const resteAPayer = result ? computeResteAPayer(row, result) : null;
    const item: PatrimoineAvailableFiscalSimulation = {
      id: row.id,
      label: '',
      fiscalYear: row.year,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      netLocatifApresImpots,
      resteAPayer,
      isValidated,
    };
    item.label = buildSimulationRowLabel(item);
    return item;
  });
  enriched.sort((a, b) => {
    if (b.fiscalYear !== a.fiscalYear) return b.fiscalYear - a.fiscalYear;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  return enriched;
}

export function resolveFiscalSimulationForPatrimoine(
  rows: LocalFiscalSimulation[],
  selectedFiscalSimulationId: string | null | undefined
): {
  fiscalRow: LocalFiscalSimulation | null;
  mode: FiscalSimulationSelectionMode;
  fiscalSimulationWarning: string | null;
} {
  const auto = pickLatestUsableFiscalSimulation(rows);
  const pref = selectedFiscalSimulationId ?? null;
  if (!pref) {
    return { fiscalRow: auto, mode: 'AUTO', fiscalSimulationWarning: null };
  }
  const found = rows.find((r) => r.id === pref);
  if (!found) {
    return {
      fiscalRow: auto,
      mode: 'MISSING_FALLBACK',
      fiscalSimulationWarning: 'Introuvable — fallback auto.',
    };
  }
  const result = parseSimulationResult(found);
  if (!result) {
    return {
      fiscalRow: auto,
      mode: 'MISSING_FALLBACK',
      fiscalSimulationWarning: 'Introuvable — fallback auto.',
    };
  }
  return { fiscalRow: found, mode: 'MANUAL', fiscalSimulationWarning: null };
}
