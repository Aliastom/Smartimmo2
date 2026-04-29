import type {
  InvestmentRecommendation,
  InvestmentSettings,
  MarketOpportunityStatus,
  MarketSnapshot,
  InvestmentActionLog,
} from '@/features/market/types';
import { computeInvestmentRecommendation, resolveDecisionTypeFromDrawdown } from '@/features/market/services/marketDecisionV2';

export { computeDrawdownPercent, normalizeThresholds, resolveMarketStatus } from '@/features/market/services/marketMetrics';
export { resolveDecisionTypeFromDrawdown };

export function buildThresholdKey(symbol: string, status: MarketOpportunityStatus): string | null {
  if (status === 'NORMAL') return null;
  return `${symbol}:${status}`;
}

/**
 * Recommandation complète (V2) : score marché, DCA + renforts % cash, garde-fous.
 */
export function computeRecommendation(
  settings: InvestmentSettings,
  snapshot: MarketSnapshot,
  history: InvestmentActionLog[] = [],
  options?: { nowMs?: number }
): InvestmentRecommendation {
  return computeInvestmentRecommendation(settings, snapshot, history, options);
}
