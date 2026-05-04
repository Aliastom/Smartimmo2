import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';
import type { InvestmentSettings } from '@/features/market/types';
import type { PortfolioAdviceOverlay } from '@/features/market/services/marketDecisionV2';
import type { PortfolioPositionComputed, PortfolioTotals } from '@/features/market/portfolio/portfolioTypes';

export function buildPortfolioPrincipalOverlay(
  settings: InvestmentSettings,
  positions: PortfolioPositionComputed[],
  totals: PortfolioTotals
): PortfolioAdviceOverlay | null {
  if (positions.length === 0 || totals.totalMarketValue <= 0) {
    return null;
  }
  const principal = normalizeMarketStorageSymbol(settings.referenceSymbol);
  const principalMv = positions
    .filter((p) => normalizeMarketStorageSymbol(p.assetSymbol) === principal)
    .reduce((sum, p) => sum + (p.marketValue ?? 0), 0);
  if (!(principalMv > 0)) {
    return {
      hasOpenPositions: true,
      portfolioValueTotal: totals.totalMarketValue,
      principalWeightPercent: null,
    };
  }
  return {
    hasOpenPositions: true,
    portfolioValueTotal: totals.totalMarketValue,
    principalWeightPercent: (principalMv / totals.totalMarketValue) * 100,
  };
}
