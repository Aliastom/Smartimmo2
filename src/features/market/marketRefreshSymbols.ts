import type { InvestmentSettings } from '@/features/market/types';
import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';
import { ETF_LIBRARY, isFullLibraryMarketRefreshable } from '@/features/market/services/etfLibrary';

export type MarketLastRefreshScope =
  | 'principal_radar'
  | 'principal_radar_comparaisons'
  | 'full_library';

export type MarketRefreshSymbolScope = 'standard' | 'full_library';

export interface MarketRecentPrincipalEntry {
  symbol: string;
  label: string;
}

const MARKET_RECENT_PRINCIPAL_PREFIX = 'smartimmo.market.recentPrincipal:';
const MARKET_COMPARE_SYMBOLS_PREFIX = 'smartimmo.market.compareSymbols:';
const MAX_RECENT_PRINCIPAL = 12;

/**
 * Liste unique et normalisée des symboles à rafraîchir (un seul lot d’appels API marché).
 * Ordre : radar, actif principal, comparaisons bibliothèque, récents bibliothèque / combo.
 */
export function buildMarketRefreshSymbols(
  settings: InvestmentSettings,
  radarSymbols: string[],
  comparedSymbols: string[],
  recentSymbols: string[]
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const n = normalizeMarketStorageSymbol(raw);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  for (const s of radarSymbols) push(s);
  push(settings.referenceSymbol);
  for (const s of comparedSymbols) push(s);
  for (const s of recentSymbols) push(s);
  return out;
}

/** Fusionne des listes de symboles déjà normalisables (dédoublonnage stable, ordre conservé par liste puis par occurrence). */
export function mergeUniqueMarketRefreshSymbols(lists: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const list of lists) {
    for (const raw of list) {
      const n = normalizeMarketStorageSymbol(raw);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      merged.push(n);
    }
  }
  return merged;
}

/**
 * Symboles normalisés de la bibliothèque trackable pour un refresh catalogue (sans le périmètre radar/principal).
 * À fusionner avec {@link buildMarketRefreshSymbols} pour le mode bibliothèque complète.
 */
export function buildFullTrackableLibrarySymbols(options?: { excludeCrypto?: boolean }): string[] {
  const excludeCrypto = options?.excludeCrypto ?? true;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of ETF_LIBRARY) {
    if (!isFullLibraryMarketRefreshable(item, { excludeCrypto })) continue;
    const n = normalizeMarketStorageSymbol(item.ticker);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function countFullMarketRefreshSymbols(
  settings: InvestmentSettings,
  organizationId: string,
  radarSymbols: string[],
  options?: { excludeCrypto?: boolean }
): number {
  const recent = readRecentPrincipalSymbols(organizationId).map((e) => e.symbol);
  const compared = readMarketCompareSymbols(organizationId);
  const standard = buildMarketRefreshSymbols(settings, radarSymbols, compared, recent);
  const library = buildFullTrackableLibrarySymbols(options ?? { excludeCrypto: true });
  return mergeUniqueMarketRefreshSymbols([standard, library]).length;
}

export function readRecentPrincipalSymbols(organizationId?: string): MarketRecentPrincipalEntry[] {
  if (!organizationId || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${MARKET_RECENT_PRINCIPAL_PREFIX}${organizationId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        symbol: normalizeMarketStorageSymbol(String((row as { symbol?: string }).symbol ?? '')),
        label: String((row as { label?: string }).label ?? '').trim() || String((row as { symbol?: string }).symbol ?? ''),
      }))
      .filter((e) => Boolean(e.symbol));
  } catch {
    return [];
  }
}

export function pushRecentPrincipalSymbol(organizationId: string, symbol: string, label: string): void {
  if (typeof window === 'undefined') return;
  const norm = normalizeMarketStorageSymbol(symbol);
  if (!norm) return;
  const prev = readRecentPrincipalSymbols(organizationId);
  const next: MarketRecentPrincipalEntry[] = [
    { symbol: norm, label: (label || norm).trim() || norm },
    ...prev.filter((e) => normalizeMarketStorageSymbol(e.symbol) !== norm),
  ].slice(0, MAX_RECENT_PRINCIPAL);
  window.localStorage.setItem(`${MARKET_RECENT_PRINCIPAL_PREFIX}${organizationId}`, JSON.stringify(next));
}

export function readMarketCompareSymbols(organizationId?: string): string[] {
  if (!organizationId || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(`${MARKET_COMPARE_SYMBOLS_PREFIX}${organizationId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.map((s) => normalizeMarketStorageSymbol(String(s))).filter(Boolean))];
  } catch {
    return [];
  }
}

export function writeMarketCompareSymbols(organizationId: string, tickers: string[]): void {
  if (typeof window === 'undefined') return;
  const normalized = [...new Set(tickers.map((t) => normalizeMarketStorageSymbol(t)).filter(Boolean))];
  window.localStorage.setItem(`${MARKET_COMPARE_SYMBOLS_PREFIX}${organizationId}`, JSON.stringify(normalized));
}

/** Symboles (normalisés) dont on recharge les snapshots Dexie en mémoire (même périmètre que le refresh global). */
export function buildMarketSnapshotKeepSet(
  settings: InvestmentSettings,
  organizationId: string,
  radarSymbols: string[]
): Set<string> {
  const recent = readRecentPrincipalSymbols(organizationId).map((e) => e.symbol);
  const compare = readMarketCompareSymbols(organizationId);
  const list = buildMarketRefreshSymbols(settings, radarSymbols, compare, recent);
  return new Set(list.map((s) => normalizeMarketStorageSymbol(s)));
}
