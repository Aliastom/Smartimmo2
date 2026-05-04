import type { InvestmentSettings } from '@/features/market/types';
import {
  computePortfolioFromOrders,
  PORTFOLIO_PRICE_FRESH_MAX_MS,
  type PriceLookup,
} from '@/features/market/portfolio/portfolioLedgerEngine';
import { estimatePortfolioTaxSimple } from '@/features/market/portfolio/portfolioFiscalEstimate';
import { surplusVsInflationEuro } from '@/features/market/portfolio/portfolioInflationEstimate';
import type {
  PortfolioAccount,
  PortfolioAccountKind,
  PortfolioOrder,
} from '@/features/market/portfolio/portfolioTypes';

const DEFAULT_INFLATION = 0.02;

export interface PortfolioSnapshotMetricsInput {
  accounts: PortfolioAccount[];
  orders: PortfolioOrder[];
  prices: PriceLookup;
  nowMs: number;
  settings: InvestmentSettings | null;
}

/** Agrège les indicateurs au moment T (même logique que l’onglet portefeuille) pour persistance dans un snapshot. */
export function buildPortfolioSnapshotMetrics(input: PortfolioSnapshotMetricsInput) {
  const { accounts, orders, prices, nowMs, settings } = input;
  const inflationAnnual = DEFAULT_INFLATION;
  const pfuRate = 0.3;
  const peaRate = settings?.peaSocialContributionsOnGainsRate ?? 0.172;

  const valuation = computePortfolioFromOrders(accounts, orders, prices, {
    nowMs,
    priceFreshMaxAgeMs: PORTFOLIO_PRICE_FRESH_MAX_MS,
  });

  const fiscalEstimate = estimatePortfolioTaxSimple({
    incomeLikeByKind: valuation.fiscalIncomeByKind as Partial<
      Record<PortfolioAccountKind, { unrealized: number; realized: number; dividends: number }>
    >,
    fiscal: { flatTaxRateOnIncome: pfuRate, peaSocialContributionsOnGainsRate: peaRate },
  });

  const surplusInflationEuro =
    valuation.totals.totalMarketValue > 0
      ? surplusVsInflationEuro({
          currentMarketValueTotal: valuation.totals.totalMarketValue,
          orders,
          annualInflationRate: inflationAnnual,
          nowMs,
        })
      : 0;

  const netPerformanceAfterTaxEuro = valuation.totals.grossPerformanceEuro - fiscalEstimate.totalTaxEstimateEuro;
  const valuationIncomplete = valuation.totals.valuationCoverage.linesMissingPrice > 0;

  return {
    totalMarketValue: valuation.totals.totalMarketValue,
    totalRemainingCostBasis: valuation.totals.totalRemainingCostBasis,
    totalUnrealizedPnL: valuation.totals.totalUnrealizedPnL,
    totalRealizedPnL: valuation.totals.totalRealizedPnL,
    totalDividendsNet: valuation.totals.totalDividendsNet,
    grossPerformanceEuro: valuation.totals.grossPerformanceEuro,
    netPerformanceAfterTaxEuro,
    surplusInflationEuro,
    valuationIncomplete,
  };
}
