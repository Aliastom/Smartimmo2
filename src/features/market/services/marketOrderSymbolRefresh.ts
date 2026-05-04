import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';
import { marketDataService } from '@/features/market/services/marketDataService';
import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';
import type { AthPeriod, MarketSnapshot } from '@/features/market/types';
import { MARKET_CACHE_ATH_PERIODS } from '@/features/market/marketSymbolAliases';

function isAthPeriod(x: string): x is AthPeriod {
  return (MARKET_CACHE_ATH_PERIODS as readonly string[]).includes(x);
}

/**
 * Récupère le cours via le service marché (Yahoo), enregistre le snapshot + historique locaux (comme le refresh radar).
 */
export async function fetchPersistMarketPriceForSymbol(
  organizationId: string,
  rawSymbol: string,
  athPeriodRaw: string | null | undefined
): Promise<{ ok: true; price: number } | { ok: false; message: string }> {
  const canonSym = normalizeMarketStorageSymbol(rawSymbol);
  if (!canonSym) {
    return { ok: false, message: 'Symbole vide ou invalide.' };
  }
  const athPeriod: AthPeriod = athPeriodRaw && isAthPeriod(athPeriodRaw) ? athPeriodRaw : 'MAX';
  const bundle = await marketDataService.fetchYahooMarketBundle({ symbol: canonSym, athPeriod });
  if (!bundle) {
    return {
      ok: false,
      message: 'Cours indisponible — vérifiez le symbole, votre connexion ou réessayez plus tard.',
    };
  }

  const now = new Date().toISOString();
  const snapshotRow: MarketSnapshot = {
    id: `${organizationId}:${canonSym}:${athPeriod}`,
    organizationId,
    symbol: canonSym,
    athPeriod,
    currentPrice: bundle.currentPrice,
    athPrice: bundle.athPrice,
    drawdownPercent: bundle.drawdownPercent,
    athDate: bundle.athDate,
    fetchedAt: now,
    source: 'yahoo-api',
  };
  await marketInvestmentStorage.saveSnapshot(snapshotRow);
  marketInvestmentStorage.savePriceHistory(organizationId, canonSym, athPeriod, bundle.history);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('market:refresh', { detail: { organizationId } }));
  }

  return { ok: true, price: bundle.currentPrice };
}
