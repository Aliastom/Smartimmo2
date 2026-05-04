import {
  MARKET_CACHE_ATH_PERIODS,
  normalizeMarketStorageSymbol,
} from '@/features/market/marketSymbolAliases';
import {
  findNearestHistoryPoint,
  isYmdCalendarToday,
  orderYmdToComparableIso,
} from '@/features/market/services/marketOrderHistoricalPrice';
import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';
import type { AthPeriod } from '@/features/market/types';

function isAthPeriod(x: string): x is AthPeriod {
  return (MARKET_CACHE_ATH_PERIODS as readonly string[]).includes(x);
}

/** Dernier cours connu en cache local (MarketSnapshot Dexie) pour la période ATH du profil. */
export async function getLastKnownUnitPriceForOrder(
  organizationId: string,
  symbol: string,
  athPeriod: string | null | undefined,
): Promise<number | null> {
  const sym = normalizeMarketStorageSymbol(symbol);
  if (!sym) return null;
  const ath: AthPeriod = athPeriod && isAthPeriod(athPeriod) ? athPeriod : 'MAX';
  const row = await marketInvestmentStorage.getSnapshot(organizationId, sym, ath);
  const p = row?.currentPrice;
  if (p == null || !Number.isFinite(p)) return null;
  return p;
}

export interface ResolveAutoOrderUnitPriceResult {
  unitPrice: number | null;
  /** Toujours renseigné sauf si symbole vide / prix introuvable. */
  source: 'historical' | 'market_cache' | 'missing';
  /** Champ `date` du point d’historique utilisé (affichage badge). */
  historicalPointDate?: string;
  /** Date passée (ou future) sans série exploitable : repli sur le dernier snapshot cache. */
  usedHistoryFallback?: boolean;
}

/**
 * Prix unitaire suggéré pour un ordre : historique local (`priceHistory`) si date ≠ aujourd’hui,
 * sinon dernier snapshot cache. Aucun appel API.
 */
export async function resolveAutoOrderUnitPrice(input: {
  organizationId: string;
  symbol: string;
  orderDateYmd: string;
  athPeriod: string | null | undefined;
}): Promise<ResolveAutoOrderUnitPriceResult> {
  const { organizationId, symbol, orderDateYmd, athPeriod } = input;
  const sym = normalizeMarketStorageSymbol(symbol.trim());
  if (!sym || !organizationId) {
    return { unitPrice: null, source: 'missing' };
  }

  const ath: AthPeriod = athPeriod && isAthPeriod(athPeriod) ? athPeriod : 'MAX';

  const lastKnown = (): Promise<ResolveAutoOrderUnitPriceResult> =>
    getLastKnownUnitPriceForOrder(organizationId, symbol, athPeriod).then((p) =>
      p != null && Number.isFinite(p)
        ? { unitPrice: p, source: 'market_cache' as const, usedHistoryFallback: true }
        : { unitPrice: null, source: 'missing' as const },
    );

  if (isYmdCalendarToday(orderDateYmd)) {
    const p = await getLastKnownUnitPriceForOrder(organizationId, symbol, athPeriod);
    if (p == null || !Number.isFinite(p)) {
      return { unitPrice: null, source: 'missing' };
    }
    return { unitPrice: p, source: 'market_cache', usedHistoryFallback: false };
  }

  const history = marketInvestmentStorage.getPriceHistory(organizationId, sym, ath);
  const targetIso = orderYmdToComparableIso(orderDateYmd);
  const nearest = findNearestHistoryPoint(history, targetIso);

  if (nearest != null) {
    return {
      unitPrice: nearest.close,
      source: 'historical',
      historicalPointDate: nearest.date,
    };
  }

  return lastKnown();
}
