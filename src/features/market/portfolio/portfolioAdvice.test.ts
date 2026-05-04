import { describe, expect, it } from 'vitest';
import { buildPortfolioPrincipalOverlay } from '@/features/market/portfolio/portfolioAdvice';
import type { InvestmentSettings } from '@/features/market/types';
import type { PortfolioPositionComputed, PortfolioTotals } from '@/features/market/portfolio/portfolioTypes';

function baseSettings(over: Partial<Pick<InvestmentSettings, 'referenceSymbol'>> = {}): InvestmentSettings {
  return { referenceSymbol: 'CW8.PA', ...over } as InvestmentSettings;
}

function totals(partial: Partial<PortfolioTotals> = {}): PortfolioTotals {
  return {
    totalMarketValue: 0,
    totalRemainingCostBasis: 0,
    totalUnrealizedPnL: 0,
    totalRealizedPnL: 0,
    totalDividendsNet: 0,
    totalFees: 0,
    totalTaxes: 0,
    grossPerformanceEuro: 0,
    valuationCoverage: {
      openLines: 0,
      linesWithMarketPrice: 0,
      linesMissingPrice: 0,
      linesStalePrice: 0,
      costBasisOpenWithoutPriceEuro: 0,
    },
    ...partial,
  };
}

describe('buildPortfolioPrincipalOverlay', () => {
  it('additionne l’actif principal sur deux enveloppes (même symbole)', () => {
    const settings = baseSettings({ referenceSymbol: 'CW8.PA' });
    const positions: PortfolioPositionComputed[] = [
      {
        accountId: 'p',
        accountName: 'PEA',
        accountKind: 'PEA',
        assetSymbol: 'CW8.PA',
        assetIsin: null,
        quantity: 5,
        averageCostPerUnit: 100,
        remainingCostBasis: 500,
        lastPrice: 100,
        lastPriceFetchedAt: null,
        priceStatus: 'fresh',
        marketValue: 500,
        indicativeValueAtCostEuro: 500,
        unrealizedPnLEuro: 0,
        unrealizedPnLPct: 0,
        realizedPnLEuro: 0,
        dividendsNet: 0,
        feesAllocated: 0,
        taxesAllocated: 0,
        warnings: [],
      },
      {
        accountId: 'c',
        accountName: 'CTO',
        accountKind: 'CTO',
        assetSymbol: 'CW8.PA',
        assetIsin: null,
        quantity: 3,
        averageCostPerUnit: 100,
        remainingCostBasis: 300,
        lastPrice: 100,
        lastPriceFetchedAt: null,
        priceStatus: 'fresh',
        marketValue: 300,
        indicativeValueAtCostEuro: 300,
        unrealizedPnLEuro: 0,
        unrealizedPnLPct: 0,
        realizedPnLEuro: 0,
        dividendsNet: 0,
        feesAllocated: 0,
        taxesAllocated: 0,
        warnings: [],
      },
    ];
    const t = totals({ totalMarketValue: 800, totalRemainingCostBasis: 800 });
    const o = buildPortfolioPrincipalOverlay(settings, positions, t);
    expect(o?.principalWeightPercent).toBeCloseTo(100, 5);
  });

  it('valeur totale nulle (cours manquants partout) : pas d’overlay', () => {
    const settings = baseSettings();
    const positions: PortfolioPositionComputed[] = [
      {
        accountId: 'p',
        accountName: 'PEA',
        accountKind: 'PEA',
        assetSymbol: 'CW8.PA',
        assetIsin: null,
        quantity: 1,
        averageCostPerUnit: 100,
        remainingCostBasis: 100,
        lastPrice: null,
        lastPriceFetchedAt: null,
        priceStatus: 'missing',
        marketValue: null,
        indicativeValueAtCostEuro: 100,
        unrealizedPnLEuro: null,
        unrealizedPnLPct: null,
        realizedPnLEuro: 0,
        dividendsNet: 0,
        feesAllocated: 0,
        taxesAllocated: 0,
        warnings: [],
      },
    ];
    const o = buildPortfolioPrincipalOverlay(settings, positions, totals({ totalMarketValue: 0 }));
    expect(o).toBeNull();
  });
});
