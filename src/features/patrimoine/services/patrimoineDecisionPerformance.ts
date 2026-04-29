import type { InvestmentActionLog, InvestmentActionType } from '@/features/market/types';
import type { MarketHistoryPoint } from '@/features/market/services/marketDataService';
import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';

export interface PatrimoineDecisionPerformanceRow {
  id: string;
  date: string;
  label: string;
  amount: number;
  priceAtDecision: number | null;
  currentPrice: number | null;
  estimatedUnits: number | null;
  estimatedValue: number | null;
  gain: number | null;
  perfPercent: number | null;
  calculable: boolean;
  etfLabel: string;
}

function actionTypeLabel(type: InvestmentActionType): string {
  if (type === 'DCA') return 'DCA';
  if (type === 'MANUAL') return 'Manuel';
  if (type.startsWith('REINFORCE')) return 'Renfort';
  return type;
}

/** Prix historique le plus proche de la date de décision (ISO). */
export function findNearestHistoricalPrice(history: MarketHistoryPoint[], decisionDateIso: string): number | null {
  const t = new Date(decisionDateIso).getTime();
  if (!Number.isFinite(t)) return null;
  let best: { diff: number; close: number } | null = null;
  for (const p of history) {
    const pt = new Date(p.date).getTime();
    if (!Number.isFinite(pt) || !Number.isFinite(p.close) || p.close <= 0) continue;
    const diff = Math.abs(pt - t);
    if (!best || diff < best.diff) {
      best = { diff, close: p.close };
    }
  }
  return best?.close ?? null;
}

export interface ComputePatrimoineDecisionPerformanceInput {
  logs: InvestmentActionLog[];
  priceHistory: MarketHistoryPoint[];
  currentPrice: number | null;
  referenceSymbol: string | null;
  limit?: number;
}

export function computePatrimoineDecisionPerformance(
  input: ComputePatrimoineDecisionPerformanceInput
): PatrimoineDecisionPerformanceRow[] {
  const { logs, priceHistory, currentPrice, referenceSymbol, limit = 5 } = input;
  const normRef = referenceSymbol ? normalizeMarketStorageSymbol(referenceSymbol) : '';

  const validated = logs
    .filter((l) => l.status === 'validated' && l.validatedAmount > 0)
    .filter((l) => !normRef || normalizeMarketStorageSymbol(l.symbolAtDecision) === normRef)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);

  return validated.map((log) => {
    const amount = log.validatedAmount;
    let priceAtDecision: number | null = null;
    if (Number.isFinite(log.currentPriceAtDecision) && log.currentPriceAtDecision > 0) {
      priceAtDecision = log.currentPriceAtDecision;
    } else {
      priceAtDecision = findNearestHistoricalPrice(priceHistory, log.date);
    }

    const calculable =
      priceAtDecision != null &&
      priceAtDecision > 0 &&
      currentPrice != null &&
      currentPrice > 0 &&
      amount > 0;

    let estimatedUnits: number | null = null;
    let estimatedValue: number | null = null;
    let gain: number | null = null;
    let perfPercent: number | null = null;

    if (calculable && priceAtDecision != null && currentPrice != null) {
      estimatedUnits = amount / priceAtDecision;
      estimatedValue = estimatedUnits * currentPrice;
      gain = estimatedValue - amount;
      perfPercent = amount > 0 ? gain / amount : null;
    }

    return {
      id: log.id,
      date: log.date,
      label: actionTypeLabel(log.type),
      amount,
      priceAtDecision,
      currentPrice,
      estimatedUnits,
      estimatedValue,
      gain,
      perfPercent,
      calculable,
      etfLabel: log.symbolAtDecision,
    };
  });
}

export function aggregatePatrimoineDecisionPerformance(rows: PatrimoineDecisionPerformanceRow[]): {
  totalInvested: number;
  estimatedCurrentValue: number;
  totalGain: number;
  calculableCount: number;
} {
  const calculableRows = rows.filter((r) => r.calculable);
  const totalInvested = rows.reduce((s, r) => s + r.amount, 0);
  const estimatedCurrentValue = calculableRows.reduce((s, r) => s + (r.estimatedValue ?? 0), 0);
  const investedCalculable = calculableRows.reduce((s, r) => s + r.amount, 0);
  const totalGain = estimatedCurrentValue - investedCalculable;
  return {
    totalInvested,
    estimatedCurrentValue,
    totalGain,
    calculableCount: calculableRows.length,
  };
}
