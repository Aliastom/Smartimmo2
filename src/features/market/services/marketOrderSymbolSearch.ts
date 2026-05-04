import {
  ETF_REFERENCE_ALIASES,
  normalizeMarketStorageSymbol,
} from '@/features/market/marketSymbolAliases';
import type {
  PortfolioOrder,
  PortfolioPositionComputed,
} from '@/features/market/portfolio/portfolioTypes';
import { ETF_LIBRARY, type EtfLibraryItem } from '@/features/market/services/etfLibrary';
import type { InvestmentSettings } from '@/features/market/types';

export type SymbolSearchTier =
  | 'principal'
  | 'radar'
  | 'held'
  | 'order_history'
  | 'library'
  | 'local_extension'
  | 'online';

export interface SymbolSearchCandidate {
  tier: SymbolSearchTier;
  /** Symbole provider / Dexie (ex. CW8.PA) — peut être un ISIN saisi librement. */
  storageSymbol: string;
  /** Libellé pour recherche et affichage. */
  name: string;
  isin?: string | null;
  currency?: string | null;
  exchange?: string | null;
  /** Prix indicateur (ex. dernier cours Yahoo lors d’une recherche en ligne). */
  lastPrice?: number | null;
  /** Pas de tentative automatique de cours local (ex. ISIN seul sans ticker coté). */
  expectNoAutoPrice?: boolean;
  /**
   * Symbole de cotation pour providers / Yahoo (si absent → `storageSymbol`).
   * Permet d’indexer par ISIN tout en utilisant un ticker exploitable pour les prix.
   */
  pricingSymbol?: string | null;
  /** Code court courtier / place (informationnel). */
  brokerSymbol?: string | null;
}

const TIER_RANK: Record<SymbolSearchTier, number> = {
  principal: 0,
  radar: 1,
  held: 2,
  order_history: 3,
  library: 4,
  local_extension: 5,
  online: 6,
};

/** Référentiel minimal hors ETF_LIBRARY (pas d’alias automatique vers un autre ticker). */
const ORDER_SEARCH_LOCAL_EXTENSIONS: SymbolSearchCandidate[] = [
  {
    tier: 'local_extension',
    storageSymbol: 'LU2655993207',
    name: 'Amundi MSCI World Swap UCITS ETF EUR Dist',
    isin: 'LU2655993207',
    currency: 'EUR',
    exchange: 'Euronext Paris',
    /** Yahoo Finance : ticker Paris (à ajuster si le provider change). */
    pricingSymbol: 'MWRD.PA',
    brokerSymbol: '1TEWLD',
    expectNoAutoPrice: false,
  },
];

/** Symbole utilisé pour cours / snapshots / Yahoo (`pricingSymbol` sinon `storageSymbol`). */
export function effectivePricingSymbol(c: SymbolSearchCandidate): string {
  const p = c.pricingSymbol?.trim();
  if (p) return normalizeMarketStorageSymbol(p);
  return normalizeMarketStorageSymbol(c.storageSymbol);
}

export function normalizeSearchIsin(raw: string): string | null {
  const t = (raw || '').trim().toUpperCase().replace(/\s/g, '');
  if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(t)) return t;
  return null;
}

export function formatSymbolSearchLine(c: SymbolSearchCandidate): string {
  const sym = normalizeMarketStorageSymbol(c.storageSymbol);
  const name = (c.name || '').trim() || '—';
  const isin = (c.isin || '').trim();
  const priceSym = c.pricingSymbol?.trim();
  let line =
    isin && isin !== sym ? `${sym} — ${name} · ${isin}` : `${sym} — ${name}`;
  if (priceSym && normalizeMarketStorageSymbol(priceSym) !== sym) {
    line += ` · cotation ${normalizeMarketStorageSymbol(priceSym)}`;
  }
  return line;
}

function upsertCandidate(
  map: Map<string, SymbolSearchCandidate>,
  next: SymbolSearchCandidate,
): void {
  const k = normalizeMarketStorageSymbol(next.storageSymbol);
  if (!k) return;
  const prev = map.get(k);
  if (!prev || TIER_RANK[next.tier] < TIER_RANK[prev.tier]) {
    map.set(k, { ...next, storageSymbol: k });
  }
}

export interface BuildMarketOrderSymbolCandidatesOptions {
  /** Positions ouvertes (après moteur portefeuille). */
  openPositions?: PortfolioPositionComputed[];
  /** Ordres déjà enregistrés (pour mémo récente). */
  recentOrders?: PortfolioOrder[];
}

/**
 * Catalogue local : principal → radar → détenu → historique d’ordres → bibliothèque ETF → extensions → en ligne (fusionné côté UI).
 */
export function buildMarketOrderSymbolCandidates(
  settings: InvestmentSettings | null,
  options?: BuildMarketOrderSymbolCandidatesOptions,
): SymbolSearchCandidate[] {
  const map = new Map<string, SymbolSearchCandidate>();

  if (settings?.referenceSymbol?.trim()) {
    upsertCandidate(map, {
      tier: 'principal',
      storageSymbol: settings.referenceSymbol.trim(),
      name: (settings.referenceLabel || '').trim() || settings.referenceSymbol.trim(),
    });
  }

  for (const alias of ETF_REFERENCE_ALIASES) {
    upsertCandidate(map, {
      tier: 'radar',
      storageSymbol: alias.defaultProviderSymbol,
      name: alias.label,
    });
  }

  for (const pos of options?.openPositions ?? []) {
    const rawSym = (pos.assetSymbol || '').trim();
    if (!rawSym || rawSym.startsWith('__')) continue;
    if (Math.abs(pos.quantity) < 1e-9) continue;
    const sym = normalizeMarketStorageSymbol(rawSym);
    upsertCandidate(map, {
      tier: 'held',
      storageSymbol: rawSym,
      name: pos.accountName ? `${sym} · détenu (${pos.accountName})` : `${sym} · détenu`,
      isin: pos.assetIsin ?? null,
    });
  }

  const orders = [...(options?.recentOrders ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const seenOrderSym = new Set<string>();
  for (const o of orders) {
    if (o.type !== 'BUY' && o.type !== 'SELL' && o.type !== 'DIVIDEND') continue;
    const rawSym = (o.assetSymbol || '').trim();
    const sym = normalizeMarketStorageSymbol(rawSym);
    if (!sym || sym === '-' || sym.startsWith('__')) continue;
    if (seenOrderSym.has(sym)) continue;
    seenOrderSym.add(sym);
    upsertCandidate(map, {
      tier: 'order_history',
      storageSymbol: rawSym,
      name: `Ordre récent · ${sym}`,
      isin: o.assetIsin ?? null,
    });
  }

  for (const item of ETF_LIBRARY as EtfLibraryItem[]) {
    upsertCandidate(map, {
      tier: 'library',
      storageSymbol: item.ticker,
      name: item.name,
      isin: item.isin,
      currency: 'EUR',
    });
  }

  for (const ext of ORDER_SEARCH_LOCAL_EXTENSIONS) {
    upsertCandidate(map, { ...ext });
  }

  return [...map.values()].sort((a, b) => {
    const d = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (d !== 0) return d;
    return normalizeMarketStorageSymbol(a.storageSymbol).localeCompare(
      normalizeMarketStorageSymbol(b.storageSymbol),
    );
  });
}

function matchesQuery(c: SymbolSearchCandidate, qLower: string): boolean {
  if (!qLower) return true;
  const sym = normalizeMarketStorageSymbol(c.storageSymbol).toLowerCase();
  const name = (c.name || '').toLowerCase();
  const isin = (c.isin || '').replace(/\s/g, '').toLowerCase();
  const qStrip = qLower.replace(/\s/g, '');
  return (
    sym.includes(qLower) || name.includes(qLower) || (isin.length > 0 && isin.includes(qStrip))
  );
}

export function filterSymbolSearchCandidates(
  candidates: SymbolSearchCandidate[],
  query: string,
): SymbolSearchCandidate[] {
  const q = query.trim().toLowerCase();
  if (!q) return candidates;
  return candidates.filter((c) => matchesQuery(c, q));
}

export function isSymbolRecognizedInCatalog(
  symbolInput: string,
  candidates: SymbolSearchCandidate[],
): boolean {
  const k = normalizeMarketStorageSymbol(symbolInput);
  const isinQ = normalizeSearchIsin(symbolInput);
  if (!k && !isinQ) return false;
  return candidates.some((c) => {
    if (k && normalizeMarketStorageSymbol(c.storageSymbol) === k) return true;
    if (isinQ && c.isin && normalizeSearchIsin(c.isin) === isinQ) return true;
    return false;
  });
}
