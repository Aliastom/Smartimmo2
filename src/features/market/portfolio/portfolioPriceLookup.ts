import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';
import { MARKET_CACHE_ATH_PERIODS, normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';
import type { AthPeriod, InvestmentSettings } from '@/features/market/types';
import type { PortfolioOrder } from '@/features/market/portfolio/portfolioTypes';
import type { PriceLookup } from '@/features/market/portfolio/portfolioLedgerEngine';

function isAthPeriod(x: string): x is AthPeriod {
  return (MARKET_CACHE_ATH_PERIODS as readonly string[]).includes(x);
}

/**
 * Cours par symbole (même logique que `usePortfolioTracker` / valorisation portefeuille).
 */
export async function fetchPortfolioPriceLookup(
  organizationId: string,
  orders: PortfolioOrder[],
  settings: InvestmentSettings | null
): Promise<PriceLookup> {
  const out: Record<string, number | null> = {};
  const meta: Record<string, { fetchedAt: string | null }> = {};
  const ath: AthPeriod = settings?.athPeriod && isAthPeriod(settings.athPeriod) ? settings.athPeriod : 'MAX';
  const symbols = new Set<string>();
  for (const o of orders) {
    if (o.assetSymbol && !o.assetSymbol.startsWith('__')) {
      symbols.add(normalizeMarketStorageSymbol(o.assetSymbol));
    }
  }
  for (const sym of symbols) {
    const row = await marketInvestmentStorage.getSnapshot(organizationId, sym, ath);
    out[sym] = row?.currentPrice ?? null;
    meta[sym] = { fetchedAt: row?.fetchedAt ?? null };
  }
  return { bySymbol: out, metaBySymbol: meta };
}
