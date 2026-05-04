import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';
import type {
  PortfolioAccount,
  PortfolioAccountKind,
  PortfolioOrder,
  PortfolioOrderType,
  PortfolioPositionComputed,
  PortfolioPositionWarning,
  PortfolioPriceStatus,
  PortfolioFiscalIncomeByKind,
  PortfolioTotals,
  PortfolioValuationCoverage,
} from '@/features/market/portfolio/portfolioTypes';

const EPS = 1e-9;

export function sortOrdersChronologically(orders: PortfolioOrder[]): PortfolioOrder[] {
  return [...orders].sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (da !== db) return da - db;
    return a.id.localeCompare(b.id);
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Montant brut négocié (hors frais) : priorité à grossAmount, sinon quantité × cours. */
export function resolveGrossTransactionAmount(o: Pick<PortfolioOrder, 'quantity' | 'unitPrice' | 'grossAmount'>): number {
  if (typeof o.grossAmount === 'number' && Number.isFinite(o.grossAmount)) {
    return Math.abs(o.grossAmount);
  }
  const q = Math.abs(o.quantity);
  const p = o.unitPrice;
  if (typeof p === 'number' && Number.isFinite(p) && q > 0) {
    return round2(q * p);
  }
  return 0;
}

interface MutableLot {
  accountId: string;
  assetSymbol: string;
  assetIsin: string | null;
  qty: number;
  /** Coût de revient restant (méthode PRU moyen). */
  costBasis: number;
  realizedPnL: number;
  dividendsNet: number;
  feesTotal: number;
  taxesTotal: number;
  warnings: PortfolioPositionWarning[];
}

function lotKey(accountId: string, symbol: string): string {
  return `${accountId}::${normalizeMarketStorageSymbol(symbol)}`;
}

function pushWarn(lot: MutableLot | undefined, w: PortfolioPositionWarning, orderId: string) {
  if (!lot) return;
  lot.warnings.push({ ...w, orderId });
}

function getOrCreateLot(
  map: Map<string, MutableLot>,
  accountId: string,
  symbolRaw: string,
  isin: string | null | undefined
): MutableLot {
  const assetSymbol = normalizeMarketStorageSymbol(symbolRaw || '');
  const key = lotKey(accountId, assetSymbol);
  const existing = map.get(key);
  if (existing) {
    if (!existing.assetIsin && isin) existing.assetIsin = isin;
    return existing;
  }
  const next: MutableLot = {
    accountId,
    assetSymbol,
    assetIsin: isin ?? null,
    qty: 0,
    costBasis: 0,
    realizedPnL: 0,
    dividendsNet: 0,
    feesTotal: 0,
    taxesTotal: 0,
    warnings: [],
  };
  map.set(key, next);
  return next;
}

function averageCost(qty: number, costBasis: number): number {
  if (qty <= EPS) return 0;
  return costBasis / qty;
}

function applyBuy(lot: MutableLot, o: PortfolioOrder) {
  const q = Math.abs(o.quantity);
  if (!(q > 0)) {
    pushWarn(lot, { code: 'ORDER_INCOHERENT', message: 'Achat sans quantité positive' }, o.id);
    return;
  }
  const gross = resolveGrossTransactionAmount(o);
  const buyFees = Math.max(0, o.fees || 0);
  const costAdd = gross > 0 ? gross + buyFees : buyFees;
  if (!(costAdd > 0)) {
    pushWarn(lot, { code: 'ORDER_INCOHERENT', message: 'Achat : montant ou cours manquant' }, o.id);
  }
  lot.qty = round2(lot.qty + q);
  lot.costBasis = round2(lot.costBasis + costAdd);
  lot.feesTotal = round2(lot.feesTotal + buyFees);
}

function applySell(lot: MutableLot, o: PortfolioOrder) {
  const q = Math.abs(o.quantity);
  if (!(q > 0)) {
    pushWarn(lot, { code: 'ORDER_INCOHERENT', message: 'Vente sans quantité positive' }, o.id);
    return;
  }
  const matchedQty = Math.min(q, lot.qty);
  if (lot.qty + EPS < q) {
    pushWarn(
      lot,
      {
        code: 'NEGATIVE_QUANTITY',
        message: `Quantité vendue (${q}) supérieure au détenu (${lot.qty.toFixed(6)}) — seules ${matchedQty.toFixed(6)} unités sont comptabilisées.`,
      },
      o.id
    );
  }
  /** Si la vente dépasse le stock, on ramène montants bruts / frais / taxes au prorata des titres réellement sortis (évite une PV fictive). */
  const scale = q > EPS ? matchedQty / q : 0;
  const grossFull = resolveGrossTransactionAmount(o);
  const gross = round2(grossFull * scale);
  const sellFees = round2(Math.max(0, o.fees || 0) * scale);
  const sellTaxes = round2(Math.max(0, o.taxes || 0) * scale);
  const proceeds = Math.max(0, gross - sellFees - sellTaxes);
  const pru = averageCost(lot.qty, lot.costBasis);
  const costRemoved = round2(matchedQty * pru);
  const realizedOnTrade = round2(proceeds - costRemoved);
  lot.realizedPnL = round2(lot.realizedPnL + realizedOnTrade);
  lot.qty = round2(lot.qty - matchedQty);
  lot.costBasis = round2(Math.max(0, lot.costBasis - costRemoved));
  lot.feesTotal = round2(lot.feesTotal + sellFees);
  lot.taxesTotal = round2(lot.taxesTotal + sellTaxes);
  if (lot.qty <= EPS) {
    lot.qty = 0;
    lot.costBasis = 0;
  }
}

function applyStandaloneFee(lot: MutableLot | undefined, o: PortfolioOrder, map: Map<string, MutableLot>, accountId: string) {
  const feeAmt = Math.max(0, o.fees || 0);
  const grossAmt = resolveGrossTransactionAmount(o);
  const amt = feeAmt > 0 ? feeAmt : grossAmt;
  const t = Math.max(0, o.taxes || 0);
  const sym = (o.assetSymbol || '').trim();
  const target = lot ?? getOrCreateLot(map, accountId, sym || '__FEES__', null);
  target.feesTotal = round2(target.feesTotal + amt);
  target.taxesTotal = round2(target.taxesTotal + t);
}

function applyStandaloneTax(map: Map<string, MutableLot>, accountId: string, o: PortfolioOrder) {
  const amt = Math.max(0, o.taxes || 0, resolveGrossTransactionAmount(o));
  const target = getOrCreateLot(map, accountId, o.assetSymbol || '__TAX__', null);
  target.taxesTotal = round2(target.taxesTotal + amt);
}

function applyTransferIn(lot: MutableLot, o: PortfolioOrder) {
  const q = Math.abs(o.quantity);
  if (!(q > 0)) {
    pushWarn(lot, { code: 'ORDER_INCOHERENT', message: 'Transfert entrant sans quantité' }, o.id);
    return;
  }
  const gross = resolveGrossTransactionAmount(o);
  const fees = Math.max(0, o.fees || 0);
  const impliedCost = gross > 0 ? gross + fees : fees;
  if (!(impliedCost > 0)) {
    pushWarn(lot, { code: 'ORDER_INCOHERENT', message: 'Transfert entrant : valoriser PRU ou montant' }, o.id);
  }
  lot.qty = round2(lot.qty + q);
  lot.costBasis = round2(lot.costBasis + impliedCost);
  lot.feesTotal = round2(lot.feesTotal + fees);
}

function applyTransferOut(lot: MutableLot, o: PortfolioOrder) {
  const q = Math.abs(o.quantity);
  if (!(q > 0)) {
    pushWarn(lot, { code: 'ORDER_INCOHERENT', message: 'Transfert sortant sans quantité' }, o.id);
    return;
  }
  if (lot.qty + EPS < q) {
    pushWarn(lot, { code: 'NEGATIVE_QUANTITY', message: 'Transfert sortant : quantité excédentaire' }, o.id);
  }
  const pru = averageCost(lot.qty, lot.costBasis);
  const costRemoved = round2(Math.min(q, lot.qty) * pru);
  lot.qty = round2(lot.qty - Math.min(q, lot.qty));
  lot.costBasis = round2(Math.max(0, lot.costBasis - costRemoved));
  if (lot.qty <= EPS) {
    lot.qty = 0;
    lot.costBasis = 0;
  }
}

/**
 * Replie la liste d’ordres sur des lots par (compte, symbole).
 * Règles : PRU moyen ; dividendes sans effet sur le PRU ; frais d’achat dans la base.
 * Vente > stock : avertissement + prorata du brut et des frais sur la quantité cédée.
 */
export function foldOrdersToLots(orders: PortfolioOrder[]): Map<string, MutableLot> {
  const sorted = sortOrdersChronologically(orders);
  const map = new Map<string, MutableLot>();

  for (const o of sorted) {
    const symRaw = (o.assetSymbol || '').trim();
    const accountId = o.accountId;
    if (!symRaw && o.type !== 'FEE' && o.type !== 'TAX') {
      /* ordre sans symbole : frais/taxe peuvent utiliser note */
    }

    const type = o.type as PortfolioOrderType;
    if (type === 'DIVIDEND') {
      const lot = symRaw
        ? getOrCreateLot(map, accountId, symRaw, o.assetIsin)
        : getOrCreateLot(map, accountId, '__DIVIDEND__', null);
      const gross = resolveGrossTransactionAmount(o);
      const tax = Math.max(0, o.taxes || 0);
      const fee = Math.max(0, o.fees || 0);
      lot.dividendsNet = round2(lot.dividendsNet + round2(Math.max(0, gross - tax - fee)));
      lot.feesTotal = round2(lot.feesTotal + fee);
      lot.taxesTotal = round2(lot.taxesTotal + tax);
      continue;
    }

    if (type === 'FEE') {
      const lot = symRaw ? getOrCreateLot(map, accountId, symRaw, o.assetIsin) : undefined;
      applyStandaloneFee(lot, o, map, accountId);
      continue;
    }

    if (type === 'TAX') {
      applyStandaloneTax(map, accountId, o);
      continue;
    }

    if (!symRaw) {
      const orphan = getOrCreateLot(map, accountId, '__UNKNOWN__', null);
      pushWarn(orphan, { code: 'UNKNOWN_ASSET_SYMBOL', message: 'Symbole actif manquant' }, o.id);
      continue;
    }

    const lot = getOrCreateLot(map, accountId, symRaw, o.assetIsin);

    switch (type) {
      case 'BUY':
        applyBuy(lot, o);
        break;
      case 'SELL':
        applySell(lot, o);
        break;
      case 'TRANSFER_IN':
        applyTransferIn(lot, o);
        break;
      case 'TRANSFER_OUT':
        applyTransferOut(lot, o);
        break;
      default:
        pushWarn(lot, { code: 'ORDER_INCOHERENT', message: `Type d’ordre non géré: ${String(type)}` }, o.id);
    }
  }

  return map;
}

/**
 * Dernière quantité détenue (compte + symbole) — pour validation de vente.
 */
export function computeHeldQuantityForAccountSymbol(orders: PortfolioOrder[], accountId: string, symbolRaw: string): number {
  const filtered = orders.filter((o) => o.accountId === accountId);
  const lots = foldOrdersToLots(filtered);
  const key = lotKey(accountId, symbolRaw);
  const lot = lots.get(key);
  return lot ? round2(lot.qty) : 0;
}

export interface PriceLookup {
  /** Dernier cours connu par symbole normalisé */
  bySymbol: Record<string, number | null | undefined>;
  /** Date `fetchedAt` du snapshot marché utilisé (par symbole). */
  metaBySymbol?: Record<string, { fetchedAt: string | null } | undefined>;
}

export interface PortfolioValuationOptions {
  nowMs?: number;
  /** Au-delà de ce délai depuis `fetchedAt`, le cours est considéré comme « ancien ». Défaut 12 h. */
  priceFreshMaxAgeMs?: number;
}

/** Aligné sur le TTL marché (actualisation radar) — exposé pour l’UI. */
export const PORTFOLIO_PRICE_FRESH_MAX_MS = 12 * 60 * 60 * 1000;
const DEFAULT_PRICE_FRESH_MS = PORTFOLIO_PRICE_FRESH_MAX_MS;

function resolvePriceMeta(symbol: string, prices: PriceLookup): { price: number | null; fetchedAt: string | null } {
  const k = normalizeMarketStorageSymbol(symbol);
  const p = prices.bySymbol[k] ?? prices.bySymbol[symbol];
  const price = typeof p === 'number' && Number.isFinite(p) && p > 0 ? p : null;
  const raw = prices.metaBySymbol?.[k]?.fetchedAt ?? prices.metaBySymbol?.[symbol]?.fetchedAt;
  const fetchedAt = typeof raw === 'string' && raw.length > 0 ? raw : null;
  return { price, fetchedAt };
}

function classifyPriceStatus(
  lastPrice: number | null,
  fetchedAtIso: string | null,
  nowMs: number,
  maxAgeMs: number
): PortfolioPriceStatus {
  if (lastPrice == null) return 'missing';
  /** Sans date de snapshot : on valorise quand même ; l’UI affichera la date comme inconnue. */
  if (!fetchedAtIso) return 'fresh';
  const t = new Date(fetchedAtIso).getTime();
  if (!Number.isFinite(t)) return 'fresh';
  return nowMs - t > maxAgeMs ? 'stale' : 'fresh';
}

function resolveLastPrice(symbol: string, prices: PriceLookup): number | null {
  return resolvePriceMeta(symbol, prices).price;
}

export function buildPortfolioPositions(params: {
  accounts: PortfolioAccount[];
  lots: Map<string, MutableLot>;
  prices: PriceLookup;
  valuation?: PortfolioValuationOptions;
}): {
  positions: PortfolioPositionComputed[];
  totals: PortfolioTotals;
  globalWarnings: PortfolioPositionWarning[];
  /** Réalisé + dividendes : tous les lots actifs (y compris positions entièrement vendues). PV latente : positions ouvertes seulement. */
  fiscalIncomeByKind: PortfolioFiscalIncomeByKind;
} {
  const nowMs = params.valuation?.nowMs ?? Date.now();
  const maxAgeMs = params.valuation?.priceFreshMaxAgeMs ?? DEFAULT_PRICE_FRESH_MS;
  const accountById = new Map(params.accounts.map((a) => [a.id, a]));
  const globalWarnings: PortfolioPositionWarning[] = [];
  const positions: PortfolioPositionComputed[] = [];

  let totalMarketValue = 0;
  let totalRemainingCostBasis = 0;
  let totalUnrealized = 0;
  let totalRealized = 0;
  let totalDiv = 0;
  let totalFees = 0;
  let totalTax = 0;

  const coverage: PortfolioValuationCoverage = {
    openLines: 0,
    linesWithMarketPrice: 0,
    linesMissingPrice: 0,
    linesStalePrice: 0,
    costBasisOpenWithoutPriceEuro: 0,
  };

  for (const lot of params.lots.values()) {
    const acc = accountById.get(lot.accountId);
    const accountName = acc?.name ?? '(Compte supprimé)';
    const accountKind = acc?.kind ?? 'AUTRE';

    totalRealized += lot.realizedPnL;
    totalDiv += lot.dividendsNet;
    totalFees += lot.feesTotal;
    totalTax += lot.taxesTotal;

    if (lot.assetSymbol.startsWith('__')) {
      continue;
    }

    const qty = lot.qty;
    const pru = averageCost(qty, lot.costBasis);
    const remainingCost = round2(lot.costBasis);

    totalRemainingCostBasis += remainingCost;

    const meta = resolvePriceMeta(lot.assetSymbol, params.prices);
    const lastPrice = meta.price;
    const lastPriceFetchedAt = meta.fetchedAt;
    const priceStatus = classifyPriceStatus(lastPrice, lastPriceFetchedAt, nowMs, maxAgeMs);

    let marketValue: number | null = null;
    let unrealized: number | null = null;
    let unrealizedPct: number | null = null;

    const warnings = [...lot.warnings];
    if (qty > EPS && lastPrice == null) {
      warnings.push({ code: 'MISSING_PRICE_FOR_VALUATION', message: 'Prix de marché absent pour valoriser la ligne' });
    }
    if (qty > EPS && priceStatus === 'stale') {
      warnings.push({
        code: 'STALE_PRICE_FOR_VALUATION',
        message: 'Cours ancien (TTL dépassé) — actualiser les données marché pour une valorisation à jour.',
      });
    }
    if (qty > EPS) {
      coverage.openLines += 1;
      if (lastPrice != null) {
        coverage.linesWithMarketPrice += 1;
        if (priceStatus === 'stale') {
          coverage.linesStalePrice += 1;
        }
      } else {
        coverage.linesMissingPrice += 1;
        coverage.costBasisOpenWithoutPriceEuro = round2(coverage.costBasisOpenWithoutPriceEuro + remainingCost);
      }
    }

    if (qty > EPS && lastPrice != null) {
      marketValue = round2(qty * lastPrice);
      unrealized = round2(marketValue - remainingCost);
      totalMarketValue += marketValue;
      if (remainingCost > EPS) {
        unrealizedPct = round2((unrealized / remainingCost) * 100);
      } else {
        unrealizedPct = null;
      }
      totalUnrealized += unrealized;
    }

    if (qty <= EPS) {
      continue;
    }

    positions.push({
      accountId: lot.accountId,
      accountName,
      accountKind,
      assetSymbol: lot.assetSymbol,
      assetIsin: lot.assetIsin,
      quantity: round2(qty),
      averageCostPerUnit: round2(pru),
      remainingCostBasis: remainingCost,
      lastPrice,
      lastPriceFetchedAt,
      priceStatus,
      marketValue,
      indicativeValueAtCostEuro: remainingCost,
      unrealizedPnLEuro: unrealized,
      unrealizedPnLPct: unrealizedPct,
      realizedPnLEuro: round2(lot.realizedPnL),
      dividendsNet: round2(lot.dividendsNet),
      feesAllocated: round2(lot.feesTotal),
      taxesAllocated: round2(lot.taxesTotal),
      warnings,
    });
  }

  /** Frais d’achat sont déjà dans le coût de revient ; frais de vente dans le réalisé. Ne pas soustraire totalFees ici. */
  const grossPerformanceEuro = round2(totalUnrealized + totalRealized + totalDiv);

  for (const lot of params.lots.values()) {
    if (lot.assetSymbol.startsWith('__')) continue;
    if (lot.warnings.some((w) => w.code === 'NEGATIVE_QUANTITY')) {
      globalWarnings.push({
        code: 'NEGATIVE_QUANTITY',
        message:
          'Quantité excédentaire sur au moins un ordre (vente / transfert > stock) — la ligne est calculée au prorata ; vérifiez l’historique ou les imports.',
      });
      break;
    }
  }

  const sortedPositions = positions.sort(
    (a, b) => b.remainingCostBasis + (b.marketValue ?? 0) - (a.remainingCostBasis + (a.marketValue ?? 0))
  );

  const fiscalIncomeByKind: PortfolioFiscalIncomeByKind = {};
  for (const lot of params.lots.values()) {
    if (lot.assetSymbol.startsWith('__')) continue;
    const kind = (accountById.get(lot.accountId)?.kind ?? 'AUTRE') as PortfolioAccountKind;
    if (!fiscalIncomeByKind[kind]) {
      fiscalIncomeByKind[kind] = { unrealized: 0, realized: 0, dividends: 0 };
    }
    const slice = fiscalIncomeByKind[kind]!;
    slice.realized = round2(slice.realized + lot.realizedPnL);
    slice.dividends = round2(slice.dividends + lot.dividendsNet);
  }
  for (const p of sortedPositions) {
    const kind = p.accountKind;
    if (!fiscalIncomeByKind[kind]) {
      fiscalIncomeByKind[kind] = { unrealized: 0, realized: 0, dividends: 0 };
    }
    const slice = fiscalIncomeByKind[kind]!;
    slice.unrealized = round2(slice.unrealized + (p.unrealizedPnLEuro ?? 0));
  }

  return {
    positions: sortedPositions,
    totals: {
      totalMarketValue: round2(totalMarketValue),
      totalRemainingCostBasis: round2(totalRemainingCostBasis),
      totalUnrealizedPnL: round2(totalUnrealized),
      totalRealizedPnL: round2(totalRealized),
      totalDividendsNet: round2(totalDiv),
      totalFees: round2(totalFees),
      totalTaxes: round2(totalTax),
      grossPerformanceEuro,
      valuationCoverage: {
        ...coverage,
        costBasisOpenWithoutPriceEuro: round2(coverage.costBasisOpenWithoutPriceEuro),
      },
    },
    globalWarnings,
    fiscalIncomeByKind,
  };
}

export function computePortfolioFromOrders(
  accounts: PortfolioAccount[],
  orders: PortfolioOrder[],
  prices: PriceLookup,
  valuation?: PortfolioValuationOptions
): ReturnType<typeof buildPortfolioPositions> {
  const lots = foldOrdersToLots(orders);
  return buildPortfolioPositions({ accounts, lots, prices, valuation });
}

/** Expose pour tests — replie les lots mutables. */
export type { MutableLot };
