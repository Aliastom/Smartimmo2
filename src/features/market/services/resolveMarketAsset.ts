import {
  ETF_REFERENCE_ALIASES,
  normalizeMarketStorageSymbol,
} from '@/features/market/marketSymbolAliases';
import type {
  PortfolioOrder,
  PortfolioPositionComputed,
} from '@/features/market/portfolio/portfolioTypes';
import {
  buildMarketOrderSymbolCandidates,
  effectivePricingSymbol,
  filterSymbolSearchCandidates,
  normalizeSearchIsin,
  type SymbolSearchCandidate,
} from '@/features/market/services/marketOrderSymbolSearch';
import { getLastKnownUnitPriceForOrder } from '@/features/market/services/marketOrderSymbolPrice';
import {
  fetchYahooSearchQuotesRaw,
  pickQuotePriceFromYahooRaw,
  type YahooSearchQuoteRaw,
} from '@/features/market/services/marketSymbolSearchOnline';
import { ETF_LIBRARY } from '@/features/market/services/etfLibrary';
import type { InvestmentSettings } from '@/features/market/types';

/** Seuil strict nom ↔ libellé Yahoo quand `quote.isin` est absent (éviter faux positifs). */
const ISIN_FALLBACK_NAME_MATCH_MIN = 0.8;

export type MarketAssetPriceSource = 'local_snapshot' | 'yahoo_search_quote' | 'none';

export type MarketAssetConfidence = 'high' | 'medium' | 'low';

export interface ResolvedMarketAsset {
  displayName: string;
  isin: string | null;
  ticker: string | null;
  /** Symbole à utiliser pour Yahoo / snapshots / historique. */
  pricingSymbol: string;
  exchange: string | null;
  currency: string | null;
  lastPrice: number | null;
  priceSource: MarketAssetPriceSource;
  confidence: MarketAssetConfidence;
}

export type ResolveMarketAssetResult =
  | { status: 'resolved'; asset: ResolvedMarketAsset }
  | { status: 'ambiguous'; candidates: ResolvedMarketAsset[]; query: string }
  | {
      status: 'manual_isin';
      asset: ResolvedMarketAsset;
      reason: 'no_online_match' | 'isin_only_local';
    }
  | { status: 'not_found'; query: string };

function buildPresetTickerGuardSet(): Set<string> {
  const s = new Set<string>();
  for (const a of ETF_REFERENCE_ALIASES) {
    s.add(normalizeMarketStorageSymbol(a.defaultProviderSymbol));
    for (const p of a.providerSymbols) {
      s.add(normalizeMarketStorageSymbol(p));
    }
  }
  return s;
}

const PRESET_TICKER_GUARD = buildPresetTickerGuardSet();

/** Tickers bibliothèque dont l’ISIN ≠ celui recherché — jamais utilisés comme « guess » pour un autre ISIN. */
function libraryTickersForOtherIsins(refIsin: string): Set<string> {
  const s = new Set<string>();
  for (const item of ETF_LIBRARY) {
    if (normalizeSearchIsin(item.isin) !== refIsin) {
      s.add(normalizeMarketStorageSymbol(item.ticker));
    }
  }
  return s;
}

/** True si la chaîne est uniquement un ISIN (pas un ticker coté type CW8.PA). */
export function isIsinOnlyStorageSymbol(raw: string): boolean {
  const t = normalizeSearchIsin((raw || '').trim());
  if (!t) return false;
  return normalizeMarketStorageSymbol(raw) === t;
}

function quoteLabel(q: YahooSearchQuoteRaw): string {
  return (q.longname || q.shortname || q.symbol || '').trim() || '—';
}

/** Pour le repli ISIN sans champ `isin` sur la quote : uniquement Paris / Euronext (pas Nasdaq, etc.). */
function isParisEuronextExchangeStrict(ex: string | undefined): boolean {
  const u = (ex || '').toUpperCase();
  return u === 'PAR' || u === 'PA' || u === 'XPAR' || u.includes('EURONEXT') || u.includes('PARIS');
}

/** Sans ISIN sur la quote : ne pas « deviner » un ETF catalogue (CW8, EWLD…) pour une requête ISIN. */
function isForbiddenPresetGuess(
  symbol: string,
  queryIsin: string | null,
  quoteIsin: string | null,
): boolean {
  if (!queryIsin) return false;
  if (quoteIsin && normalizeSearchIsin(quoteIsin) === queryIsin) return false;
  return PRESET_TICKER_GUARD.has(normalizeMarketStorageSymbol(symbol));
}

function tokenJaccard(a: string, b: string): number {
  const ta = new Set(
    a
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((x) => x.length > 2),
  );
  const tb = new Set(
    b
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((x) => x.length > 2),
  );
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const x of ta) {
    if (tb.has(x)) inter += 1;
  }
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function isLocallyWorkableTicker(c: SymbolSearchCandidate): boolean {
  if (c.expectNoAutoPrice) return false;
  const raw = (c.pricingSymbol?.trim() || c.storageSymbol).trim();
  return !isIsinOnlyStorageSymbol(raw);
}

async function fillPriceFromLocalSnapshot(
  organizationId: string,
  rawSymbol: string,
  athPeriod: string | null | undefined,
  existing: number | null,
): Promise<{ lastPrice: number | null; priceSource: MarketAssetPriceSource }> {
  if (existing != null && Number.isFinite(existing) && existing > 0) {
    return { lastPrice: existing, priceSource: 'yahoo_search_quote' };
  }
  const lp = await getLastKnownUnitPriceForOrder(organizationId, rawSymbol, athPeriod);
  if (lp != null && Number.isFinite(lp) && lp > 0) {
    return { lastPrice: lp, priceSource: 'local_snapshot' };
  }
  return { lastPrice: null, priceSource: 'none' };
}

function quoteToAsset(
  q: YahooSearchQuoteRaw,
  confidence: MarketAssetConfidence,
  lastPrice: number | null,
  priceSource: MarketAssetPriceSource,
): ResolvedMarketAsset {
  const sym = (q.symbol || '').trim();
  const isin = typeof q.isin === 'string' ? normalizeSearchIsin(q.isin) : null;
  return {
    displayName: quoteLabel(q),
    isin,
    ticker: sym || null,
    pricingSymbol: normalizeMarketStorageSymbol(sym),
    exchange: typeof q.exchange === 'string' ? q.exchange : null,
    currency: typeof q.currency === 'string' ? q.currency : null,
    lastPrice,
    priceSource,
    confidence,
  };
}

function candidateToAsset(c: SymbolSearchCandidate): ResolvedMarketAsset {
  const ps = effectivePricingSymbol(c);
  const conf: MarketAssetConfidence = isLocallyWorkableTicker(c) ? 'medium' : 'low';
  return {
    displayName: (c.name || '').trim() || ps,
    isin: c.isin ? normalizeSearchIsin(c.isin) : null,
    ticker: ps,
    pricingSymbol: ps,
    exchange: c.exchange ?? null,
    currency: c.currency ?? null,
    lastPrice: null,
    priceSource: 'none',
    confidence: conf,
  };
}

export interface ResolveMarketAssetInput {
  query: string;
  organizationId: string;
  investmentSettings: InvestmentSettings | null;
  openPositions?: PortfolioPositionComputed[];
  recentOrders?: PortfolioOrder[];
}

/**
 * Résout un actif (ISIN, ticker ou nom partiel) vers une fiche avec symbole de cotation exploitable pour les prix.
 * Ne mappe jamais un ISIN vers un ticker « catalogue » sans correspondance ISIN sur la quote Yahoo.
 */
export async function resolveMarketAsset(
  input: ResolveMarketAssetInput,
): Promise<ResolveMarketAssetResult> {
  const query = (input.query || '').trim();
  if (!query || !input.organizationId) {
    return { status: 'not_found', query };
  }

  const ath = input.investmentSettings?.athPeriod;
  const locals = buildMarketOrderSymbolCandidates(input.investmentSettings, {
    openPositions: input.openPositions,
    recentOrders: input.recentOrders,
  });

  const normQ = normalizeMarketStorageSymbol(query);
  const isinQ = normalizeSearchIsin(query);

  const localExactSym = locals.find((c) => normalizeMarketStorageSymbol(c.storageSymbol) === normQ);
  const localByIsin = isinQ
    ? locals.find((c) => c.isin && normalizeSearchIsin(c.isin) === isinQ)
    : undefined;
  const localPrimary = localExactSym ?? localByIsin;

  if (localPrimary && isLocallyWorkableTicker(localPrimary)) {
    const rawPrice = (localPrimary.pricingSymbol?.trim() || localPrimary.storageSymbol).trim();
    const ps = normalizeMarketStorageSymbol(rawPrice);
    const lp = await getLastKnownUnitPriceForOrder(input.organizationId, rawPrice, ath);
    return {
      status: 'resolved',
      asset: {
        displayName: (localPrimary.name || '').trim() || ps,
        isin: localPrimary.isin ? normalizeSearchIsin(localPrimary.isin) : isinQ,
        ticker: ps,
        pricingSymbol: ps,
        exchange: localPrimary.exchange ?? null,
        currency: localPrimary.currency ?? null,
        lastPrice: lp,
        priceSource: lp != null ? 'local_snapshot' : 'none',
        confidence: 'high',
      },
    };
  }

  const nameHits = filterSymbolSearchCandidates(locals, query);
  if (!isinQ && nameHits.length > 1) {
    return {
      status: 'ambiguous',
      candidates: nameHits.map((c) => candidateToAsset(c)),
      query,
    };
  }
  if (!isinQ && nameHits.length === 1) {
    const c = nameHits[0]!;
    if (isLocallyWorkableTicker(c)) {
      const rawPrice = (c.pricingSymbol?.trim() || c.storageSymbol).trim();
      const ps = normalizeMarketStorageSymbol(rawPrice);
      const lp = await getLastKnownUnitPriceForOrder(input.organizationId, rawPrice, ath);
      return {
        status: 'resolved',
        asset: {
          displayName: (c.name || '').trim() || normQ,
          isin: c.isin ? normalizeSearchIsin(c.isin) : null,
          ticker: ps,
          pricingSymbol: ps,
          exchange: c.exchange ?? null,
          currency: c.currency ?? null,
          lastPrice: lp,
          priceSource: lp != null ? 'local_snapshot' : 'none',
          confidence: 'medium',
        },
      };
    }
  }

  const refName = (localByIsin?.name || localPrimary?.name || '').trim();
  const refIsin = isinQ ?? (localByIsin?.isin ? normalizeSearchIsin(localByIsin.isin) : null);

  const online = await fetchYahooSearchQuotesRaw(query);
  if (online.length === 0) {
    if (refIsin) {
      return {
        status: 'manual_isin',
        reason: 'no_online_match',
        asset: {
          displayName: refName || query,
          isin: refIsin,
          ticker: null,
          pricingSymbol: refIsin,
          exchange: localByIsin?.exchange ?? null,
          currency: localByIsin?.currency ?? null,
          lastPrice: null,
          priceSource: 'none',
          confidence: 'low',
        },
      };
    }
    return { status: 'not_found', query };
  }

  if (refIsin) {
    const isinMatches = online.filter((q) => {
      const qi = typeof q.isin === 'string' ? normalizeSearchIsin(q.isin) : null;
      return qi === refIsin;
    });
    if (isinMatches.length > 1) {
      const assets: ResolvedMarketAsset[] = [];
      for (const q of isinMatches) {
        const rawSym = (q.symbol || '').trim();
        if (!rawSym) continue;
        const lp0 = pickQuotePriceFromYahooRaw(q);
        const { lastPrice, priceSource } = await fillPriceFromLocalSnapshot(
          input.organizationId,
          rawSym,
          ath,
          lp0,
        );
        assets.push(quoteToAsset(q, 'high', lastPrice, priceSource));
      }
      return { status: 'ambiguous', candidates: assets, query };
    }
    if (isinMatches.length === 1) {
      const q = isinMatches[0]!;
      const rawSym = (q.symbol || '').trim();
      if (!rawSym) {
        return {
          status: 'manual_isin',
          reason: 'no_online_match',
          asset: {
            displayName: refName || query,
            isin: refIsin,
            ticker: null,
            pricingSymbol: refIsin,
            exchange: localByIsin?.exchange ?? null,
            currency: localByIsin?.currency ?? null,
            lastPrice: null,
            priceSource: 'none',
            confidence: 'low',
          },
        };
      }
      const lp0 = pickQuotePriceFromYahooRaw(q);
      const { lastPrice, priceSource } = await fillPriceFromLocalSnapshot(
        input.organizationId,
        rawSym,
        ath,
        lp0,
      );
      return {
        status: 'resolved',
        asset: quoteToAsset(q, 'high', lastPrice, priceSource),
      };
    }

    const wrongLibraryTickers = libraryTickersForOtherIsins(refIsin);

    const scoredIsinFallback = online
      .map((q): { q: YahooSearchQuoteRaw; score: number } | null => {
        const sym = (q.symbol || '').trim();
        if (!sym) return null;

        const qiRaw = typeof q.isin === 'string' ? normalizeSearchIsin(q.isin) : null;
        if (qiRaw && qiRaw !== refIsin) return null;

        if (isForbiddenPresetGuess(sym, refIsin, qiRaw)) return null;
        if (wrongLibraryTickers.has(normalizeMarketStorageSymbol(sym))) return null;

        const cur = (q.currency || '').trim().toUpperCase();
        if (cur !== 'EUR') return null;

        if (!isParisEuronextExchangeStrict(q.exchange)) return null;

        if (!refName) return null;

        const score = tokenJaccard(refName, quoteLabel(q));
        if (score < ISIN_FALLBACK_NAME_MATCH_MIN) return null;

        return { q, score };
      })
      .filter((x): x is { q: YahooSearchQuoteRaw; score: number } => x != null);

    scoredIsinFallback.sort((a, b) => b.score - a.score);

    if (scoredIsinFallback.length > 1) {
      const assets: ResolvedMarketAsset[] = [];
      for (const { q } of scoredIsinFallback) {
        const rawSym = (q.symbol || '').trim();
        if (!rawSym) continue;
        const lp0 = pickQuotePriceFromYahooRaw(q);
        const { lastPrice, priceSource } = await fillPriceFromLocalSnapshot(
          input.organizationId,
          rawSym,
          ath,
          lp0,
        );
        assets.push(quoteToAsset(q, 'medium', lastPrice, priceSource));
      }
      return { status: 'ambiguous', candidates: assets, query };
    }
    if (scoredIsinFallback.length === 1) {
      const q = scoredIsinFallback[0]!.q;
      const rawSym = (q.symbol || '').trim();
      const lp0 = pickQuotePriceFromYahooRaw(q);
      const { lastPrice, priceSource } = await fillPriceFromLocalSnapshot(
        input.organizationId,
        rawSym,
        ath,
        lp0,
      );
      return {
        status: 'resolved',
        asset: quoteToAsset(q, 'medium', lastPrice, priceSource),
      };
    }

    return {
      status: 'manual_isin',
      reason: 'no_online_match',
      asset: {
        displayName: refName || query,
        isin: refIsin,
        ticker: null,
        pricingSymbol: refIsin,
        exchange: localByIsin?.exchange ?? null,
        currency: localByIsin?.currency ?? null,
        lastPrice: null,
        priceSource: 'none',
        confidence: 'low',
      },
    };
  }

  if (online.length === 1) {
    const q = online[0]!;
    const rawSym = (q.symbol || '').trim();
    if (!rawSym) return { status: 'not_found', query };
    const lp0 = pickQuotePriceFromYahooRaw(q);
    const { lastPrice, priceSource } = await fillPriceFromLocalSnapshot(
      input.organizationId,
      rawSym,
      ath,
      lp0,
    );
    return {
      status: 'resolved',
      asset: quoteToAsset(q, 'medium', lastPrice, priceSource),
    };
  }

  if (online.length > 1) {
    const assets: ResolvedMarketAsset[] = [];
    for (const q of online) {
      const rawSym = (q.symbol || '').trim();
      if (!rawSym) continue;
      const lp0 = pickQuotePriceFromYahooRaw(q);
      const { lastPrice, priceSource } = await fillPriceFromLocalSnapshot(
        input.organizationId,
        rawSym,
        ath,
        lp0,
      );
      assets.push(quoteToAsset(q, 'low', lastPrice, priceSource));
    }
    if (assets.length > 1) {
      return { status: 'ambiguous', candidates: assets, query };
    }
    if (assets.length === 1) {
      return { status: 'resolved', asset: assets[0]! };
    }
  }

  return { status: 'not_found', query };
}
