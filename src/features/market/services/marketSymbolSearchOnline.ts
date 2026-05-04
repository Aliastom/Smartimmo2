import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';
import type { SymbolSearchCandidate } from '@/features/market/services/marketOrderSymbolSearch';

export interface YahooSearchQuoteRaw {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  currency?: string;
  quoteType?: string;
  isin?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
}

function pickName(q: YahooSearchQuoteRaw): string {
  return (q.longname || q.shortname || q.symbol || '').trim() || '—';
}

export function pickQuotePriceFromYahooRaw(q: YahooSearchQuoteRaw): number | null {
  const a = Number(q.regularMarketPrice);
  if (Number.isFinite(a) && a > 0) return a;
  const b = Number(q.regularMarketPreviousClose);
  if (Number.isFinite(b) && b > 0) return b;
  return null;
}

/**
 * Recherche en ligne (Yahoo via route Next) — pas de logique de confusion entre actifs : chaque quote garde son symbole.
 */
export async function fetchOnlineSymbolSearchCandidates(
  query: string,
): Promise<SymbolSearchCandidate[]> {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`, {
    method: 'GET',
    cache: 'no-store',
  });
  const json = (await res.json()) as { ok?: boolean; quotes?: YahooSearchQuoteRaw[] };
  if (!json?.ok || !Array.isArray(json.quotes)) return [];

  const out: SymbolSearchCandidate[] = [];
  const seen = new Set<string>();
  for (const raw of json.quotes) {
    const sym = (raw.symbol || '').trim();
    if (!sym) continue;
    const k = normalizeMarketStorageSymbol(sym);
    if (seen.has(k)) continue;
    seen.add(k);

    const lp = pickQuotePriceFromYahooRaw(raw);
    out.push({
      tier: 'online',
      storageSymbol: sym,
      pricingSymbol: sym,
      name: pickName(raw),
      isin: typeof raw.isin === 'string' ? raw.isin.trim().toUpperCase() : null,
      currency: typeof raw.currency === 'string' ? raw.currency : null,
      exchange: typeof raw.exchange === 'string' ? raw.exchange : null,
      lastPrice: lp,
      expectNoAutoPrice: false,
    });
  }
  return out;
}

/** Réponses brutes Yahoo Search (pour résolution ISIN / scoring hors composant UI). */
export async function fetchYahooSearchQuotesRaw(query: string): Promise<YahooSearchQuoteRaw[]> {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`, {
    method: 'GET',
    cache: 'no-store',
  });
  const json = (await res.json()) as { ok?: boolean; quotes?: YahooSearchQuoteRaw[] };
  if (!json?.ok || !Array.isArray(json.quotes)) return [];
  return json.quotes;
}
