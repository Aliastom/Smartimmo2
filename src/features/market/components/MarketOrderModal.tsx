'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { MarketOrderSymbolCombobox } from '@/features/market/components/MarketOrderSymbolCombobox';
import { computeHeldQuantityForAccountSymbol } from '@/features/market/portfolio/portfolioLedgerEngine';
import type { usePortfolioTracker } from '@/features/market/hooks/usePortfolioTracker';
import { kindLabel } from '@/features/market/portfolio/portfolioAccountAggregates';
import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';
import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';
import {
  buildMarketOrderSymbolCandidates,
  effectivePricingSymbol,
  isSymbolRecognizedInCatalog,
  normalizeSearchIsin,
  type SymbolSearchCandidate,
} from '@/features/market/services/marketOrderSymbolSearch';
import { formatHistoricalBadgeDate } from '@/features/market/services/marketOrderHistoricalPrice';
import { fetchOnlineSymbolSearchCandidates } from '@/features/market/services/marketSymbolSearchOnline';
import {
  type ResolveAutoOrderUnitPriceResult,
  resolveAutoOrderUnitPrice,
} from '@/features/market/services/marketOrderSymbolPrice';
import {
  resolveMarketAsset,
  type ResolvedMarketAsset,
} from '@/features/market/services/resolveMarketAsset';
import { fetchPersistMarketPriceForSymbol } from '@/features/market/services/marketOrderSymbolRefresh';
import type { InvestmentSettings } from '@/features/market/types';

type PortfolioHook = ReturnType<typeof usePortfolioTracker>;

export type MarketOrderModalMode = 'BUY' | 'SELL' | 'DIVIDEND' | 'FEE';

/** Origine du cours affiché dans la modal ordre (hors ledger). */
export type MarketOrderUnitPriceSource =
  | 'historical'
  | 'market_cache'
  | 'recommendation'
  | 'manual'
  | 'missing';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface MarketOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: MarketOrderModalMode;
  portfolio: PortfolioHook;
  organizationId: string;
  defaultCurrency: string;
  /** Compte à pré-sélectionner (ex. depuis une carte compte). */
  initialAccountId?: string | null;
  /** Compte par défaut stocké localement (repli si pas d’initial). */
  preferredDefaultAccountId?: string | null;
}

export function MarketOrderModal({
  open,
  onOpenChange,
  mode,
  portfolio,
  organizationId,
  defaultCurrency,
  initialAccountId = null,
  preferredDefaultAccountId = null,
}: MarketOrderModalProps) {
  const [accountId, setAccountId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [fees, setFees] = useState('0');
  const [taxes, setTaxes] = useState('0');
  const [dividendGross, setDividendGross] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [investmentSettings, setInvestmentSettings] = useState<InvestmentSettings | null>(null);
  /** Si défini et égal au symbole courant (normalisé), le cours unitaire n’est pas écrasé par le cache / actualisation. */
  const manualPriceLockNormRef = useRef<string | null>(null);
  /** Ignore la prochaine exécution auto du cours (sélection prix en ligne / ISIN sans cours). Compteur pour le Strict Mode. */
  const skipNextAutoApplyCountRef = useRef(0);
  const [priceSource, setPriceSource] = useState<MarketOrderUnitPriceSource>('missing');
  /** Date du point `priceHistory` utilisé (badge), si `historical`. */
  const [historicalPointDate, setHistoricalPointDate] = useState<string | null>(null);
  /** Date passée sans série locale : repli sur le dernier snapshot. */
  const [historyFallbackHint, setHistoryFallbackHint] = useState(false);
  const [refreshingPrice, setRefreshingPrice] = useState(false);
  const [refreshPriceError, setRefreshPriceError] = useState<string | null>(null);
  const [onlineCandidates, setOnlineCandidates] = useState<SymbolSearchCandidate[]>([]);
  const [onlineSearchBusy, setOnlineSearchBusy] = useState(false);
  const [orderAssetIsin, setOrderAssetIsin] = useState<string | null>(null);
  const [assetDisplayName, setAssetDisplayName] = useState<string | null>(null);
  const [priceManualHint, setPriceManualHint] = useState<string | null>(null);
  const [resolvedAssetCard, setResolvedAssetCard] = useState<ResolvedMarketAsset | null>(null);
  const [resolveAmbiguousOptions, setResolveAmbiguousOptions] = useState<
    ResolvedMarketAsset[] | null
  >(null);
  const [resolveIsinBusy, setResolveIsinBusy] = useState(false);

  const symbolCandidates = useMemo(
    () => [
      ...buildMarketOrderSymbolCandidates(investmentSettings, {
        openPositions: portfolio.positions,
        recentOrders: portfolio.orders,
      }),
      ...onlineCandidates,
    ],
    [investmentSettings, portfolio.positions, portfolio.orders, onlineCandidates],
  );

  const applyAutoUnitPrice = useCallback(
    async (
      rawSymbol: string,
      orderDateYmd: string,
    ): Promise<ResolveAutoOrderUnitPriceResult | null> => {
      if (skipNextAutoApplyCountRef.current > 0) {
        skipNextAutoApplyCountRef.current -= 1;
        return null;
      }
      const norm = normalizeMarketStorageSymbol(rawSymbol.trim());
      if (!norm || !organizationId) {
        setUnitPrice('');
        setPriceSource('missing');
        setHistoricalPointDate(null);
        setHistoryFallbackHint(false);
        return null;
      }
      if (manualPriceLockNormRef.current && manualPriceLockNormRef.current === norm) {
        return null;
      }
      setUnitPrice('');
      setPriceSource('missing');
      setHistoricalPointDate(null);
      setHistoryFallbackHint(false);
      const r = await resolveAutoOrderUnitPrice({
        organizationId,
        symbol: rawSymbol,
        orderDateYmd,
        athPeriod: investmentSettings?.athPeriod,
      });
      if (manualPriceLockNormRef.current && manualPriceLockNormRef.current === norm) {
        return null;
      }
      if (r.unitPrice != null && Number.isFinite(r.unitPrice)) {
        setPriceManualHint(null);
        setUnitPrice(String(round2(r.unitPrice)));
        if (r.source === 'historical') {
          setPriceSource('historical');
          setHistoricalPointDate(r.historicalPointDate ?? null);
          setHistoryFallbackHint(false);
        } else {
          setPriceSource('market_cache');
          setHistoricalPointDate(null);
          setHistoryFallbackHint(!!r.usedHistoryFallback);
        }
      } else if (r.unitPrice == null && normalizeSearchIsin(rawSymbol.trim())) {
        setPriceManualHint('Prix automatique indisponible — saisie manuelle');
      }
      return r;
    },
    [organizationId, investmentSettings?.athPeriod],
  );

  useEffect(() => {
    if (!open) return;
    setDate(new Date().toISOString().slice(0, 10));
    setSymbol('');
    setUnitPrice('');
    setQty('');
    setDividendGross('');
    setFeeAmount('');
    setNote('');
    manualPriceLockNormRef.current = null;
    setPriceSource('missing');
    setHistoricalPointDate(null);
    setHistoryFallbackHint(false);
    setRefreshPriceError(null);
    setOnlineCandidates([]);
    setOnlineSearchBusy(false);
    setOrderAssetIsin(null);
    setAssetDisplayName(null);
    setPriceManualHint(null);
    skipNextAutoApplyCountRef.current = 0;
  }, [open, mode]);

  useEffect(() => {
    if (!open || !organizationId) return;
    void marketInvestmentStorage.getSettings(organizationId).then(setInvestmentSettings);
  }, [open, organizationId]);

  useEffect(() => {
    if (!open) return;
    const ids = new Set(portfolio.accounts.map((a) => a.id));
    const pick =
      (initialAccountId && ids.has(initialAccountId) ? initialAccountId : null) ??
      (preferredDefaultAccountId && ids.has(preferredDefaultAccountId)
        ? preferredDefaultAccountId
        : null) ??
      portfolio.accounts[0]?.id ??
      '';
    setAccountId(pick);
  }, [open, mode, initialAccountId, preferredDefaultAccountId, portfolio.accounts]);

  useEffect(() => {
    if (!open) return;
    if (mode !== 'BUY' && mode !== 'SELL') return;
    const t = window.setTimeout(() => {
      const s = symbol.trim();
      if (!s) {
        setUnitPrice('');
        setPriceSource('missing');
        setHistoricalPointDate(null);
        setHistoryFallbackHint(false);
        return;
      }
      void applyAutoUnitPrice(s, date);
    }, 450);
    return () => window.clearTimeout(t);
  }, [symbol, date, open, mode, applyAutoUnitPrice]);

  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  useEffect(() => {
    if (!open || !investmentSettings || (mode !== 'BUY' && mode !== 'SELL')) return;
    const s = symbolRef.current.trim();
    if (!s) return;
    const norm = normalizeMarketStorageSymbol(s);
    if (manualPriceLockNormRef.current === norm) return;
    void applyAutoUnitPrice(s, date);
  }, [open, mode, investmentSettings, investmentSettings?.athPeriod, date, applyAutoUnitPrice]);

  const handleSymbolInputChange = useCallback(
    (next: string) => {
      const prevNorm = normalizeMarketStorageSymbol(symbol.trim());
      const nextNorm = normalizeMarketStorageSymbol(next.trim());
      if (prevNorm !== nextNorm) {
        manualPriceLockNormRef.current = null;
        setRefreshPriceError(null);
        setOnlineCandidates([]);
        setOrderAssetIsin(null);
        setAssetDisplayName(null);
        setPriceManualHint(null);
        setResolvedAssetCard(null);
        setResolveAmbiguousOptions(null);
      }
      setSymbol(next);
    },
    [symbol],
  );

  const handleOnlineSymbolSearch = useCallback(async () => {
    const q = symbol.trim();
    if (q.length < 2) return;
    setOnlineSearchBusy(true);
    try {
      const hits = await fetchOnlineSymbolSearchCandidates(q);
      setOnlineCandidates(hits);
    } finally {
      setOnlineSearchBusy(false);
    }
  }, [symbol]);

  const symbolUnrecognized = useMemo(() => {
    const s = symbol.trim();
    if (!s) return false;
    return !isSymbolRecognizedInCatalog(s, symbolCandidates);
  }, [symbol, symbolCandidates]);

  const showResolveIsinButton = useMemo(() => {
    if (mode !== 'BUY' && mode !== 'SELL') return false;
    if (!normalizeSearchIsin(symbol.trim())) return false;
    return priceSource === 'missing' || unitPrice.trim() === '' || Boolean(priceManualHint);
  }, [mode, symbol, priceSource, unitPrice, priceManualHint]);

  const applyResolvedMarketAsset = useCallback(
    (asset: ResolvedMarketAsset) => {
      setResolveAmbiguousOptions(null);
      setResolvedAssetCard(asset);
      manualPriceLockNormRef.current = null;
      setPriceManualHint(null);
      setSymbol(asset.pricingSymbol);
      setOrderAssetIsin(asset.isin);
      setAssetDisplayName(asset.displayName);
      if (mode !== 'BUY' && mode !== 'SELL') return;
      if (asset.lastPrice != null && asset.lastPrice > 0) {
        skipNextAutoApplyCountRef.current = 1;
        setUnitPrice(String(round2(asset.lastPrice)));
        setPriceSource('market_cache');
        setHistoricalPointDate(null);
        setHistoryFallbackHint(false);
        return;
      }
      void applyAutoUnitPrice(asset.pricingSymbol, date);
    },
    [applyAutoUnitPrice, date, mode],
  );

  const handleResolveIsin = useCallback(async () => {
    if (!organizationId || !investmentSettings) return;
    const q = symbol.trim();
    if (!normalizeSearchIsin(q)) return;
    setResolveIsinBusy(true);
    try {
      const r = await resolveMarketAsset({
        query: q,
        organizationId,
        investmentSettings,
        openPositions: portfolio.positions,
        recentOrders: portfolio.orders,
      });
      if (r.status === 'resolved') {
        applyResolvedMarketAsset(r.asset);
      } else if (r.status === 'ambiguous') {
        setResolveAmbiguousOptions(r.candidates);
        setResolvedAssetCard(null);
      } else if (r.status === 'manual_isin') {
        skipNextAutoApplyCountRef.current = 1;
        setResolvedAssetCard(r.asset);
        setSymbol(r.asset.pricingSymbol);
        setOrderAssetIsin(r.asset.isin);
        setAssetDisplayName(r.asset.displayName);
        setUnitPrice('');
        setPriceSource('missing');
        setPriceManualHint('Prix automatique indisponible — saisie manuelle');
      }
    } finally {
      setResolveIsinBusy(false);
    }
  }, [
    organizationId,
    investmentSettings,
    symbol,
    portfolio.positions,
    portfolio.orders,
    applyResolvedMarketAsset,
  ]);

  const onPickSymbolCandidate = useCallback(
    (c: SymbolSearchCandidate) => {
      manualPriceLockNormRef.current = null;
      setRefreshPriceError(null);
      setPriceManualHint(null);
      setOnlineCandidates([]);
      const priceSym = effectivePricingSymbol(c);
      setSymbol(priceSym);
      setOrderAssetIsin(c.isin?.trim() || null);
      setAssetDisplayName((c.name || '').trim() || null);

      if (mode !== 'BUY' && mode !== 'SELL') return;

      if (c.lastPrice != null && Number.isFinite(c.lastPrice) && c.lastPrice > 0) {
        skipNextAutoApplyCountRef.current = 1;
        setUnitPrice(String(round2(c.lastPrice)));
        setPriceSource('market_cache');
        setHistoricalPointDate(null);
        setHistoryFallbackHint(false);
        return;
      }

      if (c.expectNoAutoPrice) {
        skipNextAutoApplyCountRef.current = 1;
        setUnitPrice('');
        setPriceSource('missing');
        setPriceManualHint('Prix automatique indisponible — saisie manuelle');
        return;
      }
    },
    [mode],
  );

  const onRefreshMarketPrice = useCallback(async () => {
    if (!organizationId || !symbol.trim()) return;
    const norm = normalizeMarketStorageSymbol(symbol.trim());
    if (manualPriceLockNormRef.current && manualPriceLockNormRef.current === norm) {
      return;
    }
    setRefreshingPrice(true);
    setRefreshPriceError(null);
    try {
      const r = await fetchPersistMarketPriceForSymbol(
        organizationId,
        symbol,
        investmentSettings?.athPeriod,
      );
      if (!r.ok) {
        setRefreshPriceError(r.message);
        return;
      }
      if (manualPriceLockNormRef.current && manualPriceLockNormRef.current === norm) {
        return;
      }
      setUnitPrice(String(round2(r.price)));
      setPriceSource('recommendation');
      setHistoricalPointDate(null);
      setHistoryFallbackHint(false);
    } finally {
      setRefreshingPrice(false);
    }
  }, [organizationId, symbol, investmentSettings?.athPeriod]);

  const qtyNum = useMemo(() => {
    const v = Number(qty.replace(',', '.'));
    return Number.isFinite(v) ? v : 0;
  }, [qty]);

  const unitPriceNum = useMemo(() => {
    const raw = unitPrice.trim().replace(',', '.');
    if (raw === '') return null;
    const v = Number(raw);
    return Number.isFinite(v) ? v : null;
  }, [unitPrice]);

  const computedGross = useMemo(() => {
    if (mode !== 'BUY' && mode !== 'SELL') return null;
    if (unitPriceNum == null || !(qtyNum > 0)) return null;
    return round2(qtyNum * unitPriceNum);
  }, [mode, qtyNum, unitPriceNum]);

  const heldQty = useMemo(() => {
    if (mode !== 'SELL' || !accountId || !symbol.trim()) return null;
    return computeHeldQuantityForAccountSymbol(portfolio.orders, accountId, symbol.trim());
  }, [mode, accountId, symbol, portfolio.orders]);

  const sellExceedsHeld = mode === 'SELL' && heldQty != null && qtyNum > heldQty + 1e-9;
  const sellInvalid = mode === 'SELL' && (!(qtyNum > 0) || !symbol.trim());

  const title =
    mode === 'BUY'
      ? 'Nouvel achat'
      : mode === 'SELL'
        ? 'Nouvelle vente'
        : mode === 'DIVIDEND'
          ? 'Dividende ou distribution'
          : 'Frais';

  const submit = async () => {
    if (!organizationId || !accountId) return;
    if (mode === 'SELL' && sellExceedsHeld) return;
    setSaving(true);
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const sym = normalizeMarketStorageSymbol(symbol.trim() || '-');
      const resolvedIsin = orderAssetIsin ?? normalizeSearchIsin(symbol.trim());
      const isoDate = new Date(date + 'T12:00:00.000Z').toISOString();
      const feesN = Number(fees.replace(',', '.')) || 0;
      const taxesN = Number(taxes.replace(',', '.')) || 0;

      if (mode === 'BUY') {
        const gross = computedGross ?? 0;
        await portfolio.saveOrder({
          id,
          organizationId,
          accountId,
          assetSymbol: sym,
          assetIsin: resolvedIsin,
          type: 'BUY',
          date: isoDate,
          quantity: qtyNum,
          unitPrice: unitPriceNum,
          grossAmount: gross > 0 ? gross : null,
          fees: feesN,
          taxes: taxesN,
          currency: defaultCurrency,
          note: note.trim() || null,
          createdAt: now,
          updatedAt: now,
        });
      } else if (mode === 'SELL') {
        const gross = computedGross ?? 0;
        await portfolio.saveOrder({
          id,
          organizationId,
          accountId,
          assetSymbol: sym,
          assetIsin: resolvedIsin,
          type: 'SELL',
          date: isoDate,
          quantity: qtyNum,
          unitPrice: unitPriceNum,
          grossAmount: gross > 0 ? gross : null,
          fees: feesN,
          taxes: taxesN,
          currency: defaultCurrency,
          note: note.trim() || null,
          createdAt: now,
          updatedAt: now,
        });
      } else if (mode === 'DIVIDEND') {
        const gross = Number(dividendGross.replace(',', '.')) || 0;
        await portfolio.saveOrder({
          id,
          organizationId,
          accountId,
          assetSymbol: sym,
          assetIsin: resolvedIsin,
          type: 'DIVIDEND',
          date: isoDate,
          quantity: 0,
          unitPrice: null,
          grossAmount: gross,
          fees: feesN,
          taxes: taxesN,
          currency: defaultCurrency,
          note: note.trim() || null,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        const amt = Number(feeAmount.replace(',', '.')) || 0;
        await portfolio.saveOrder({
          id,
          organizationId,
          accountId,
          assetSymbol: sym === '-' ? '-' : sym,
          type: 'FEE',
          date: isoDate,
          quantity: 0,
          unitPrice: null,
          grossAmount: amt > 0 ? amt : null,
          fees: amt > 0 ? amt : feesN,
          taxes: 0,
          currency: defaultCurrency,
          note: note.trim() || null,
          createdAt: now,
          updatedAt: now,
        });
      }

      onOpenChange(false);
      setNote('');
      setQty('');
      setUnitPrice('');
      setSymbol('');
      manualPriceLockNormRef.current = null;
      setPriceSource('missing');
      setHistoricalPointDate(null);
      setHistoryFallbackHint(false);
      setOrderAssetIsin(null);
      setAssetDisplayName(null);
      setPriceManualHint(null);
      setResolvedAssetCard(null);
      setResolveAmbiguousOptions(null);
      await portfolio.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {(() => {
            const acc = portfolio.accounts.find((a) => a.id === accountId);
            if (!acc) return null;
            return (
              <div className="rounded-xl border border-violet-200 bg-violet-50/90 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
                  Compte sélectionné
                </p>
                <p className="mt-0.5 text-sm font-semibold text-violet-950">
                  {acc.name} · {kindLabel(acc.kind)} · {acc.currency}
                </p>
              </div>
            );
          })()}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Compte</label>
            <select
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">Choisir…</option>
              {portfolio.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.kind})
                </option>
              ))}
            </select>
          </div>

          {mode !== 'FEE' && (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-medium text-slate-700" htmlFor="market-order-symbol">
                  Symbole
                </label>
                {symbolUnrecognized && symbol.trim() && (
                  <Badge variant="warning" size="sm">
                    Symbole non reconnu
                  </Badge>
                )}
              </div>
              <MarketOrderSymbolCombobox
                id="market-order-symbol"
                value={symbol}
                onInputChange={handleSymbolInputChange}
                onSelectCandidate={onPickSymbolCandidate}
                candidates={symbolCandidates}
                disabled={!organizationId}
                onRequestOnlineSearch={() => void handleOnlineSymbolSearch()}
                onlineSearchLoading={onlineSearchBusy}
              />
              {assetDisplayName && symbol.trim() !== '' && (
                <p className="text-[11px] leading-snug text-slate-600">{assetDisplayName}</p>
              )}
              {(mode === 'BUY' || mode === 'SELL') &&
                showResolveIsinButton &&
                organizationId &&
                investmentSettings && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1 h-8 w-full text-xs"
                    disabled={resolveIsinBusy}
                    onClick={() => void handleResolveIsin()}
                  >
                    {resolveIsinBusy ? 'Résolution…' : 'Résoudre l’ISIN'}
                  </Button>
                )}
              {resolveAmbiguousOptions && resolveAmbiguousOptions.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-2 py-2 text-[11px] text-amber-950">
                  <p className="font-semibold">Plusieurs correspondances — choisir :</p>
                  <ul className="mt-1 space-y-1">
                    {resolveAmbiguousOptions.map((a, i) => (
                      <li key={`${a.pricingSymbol}-${i}`}>
                        <button
                          type="button"
                          className="w-full rounded-lg border border-amber-300/80 bg-white px-2 py-1.5 text-left hover:bg-amber-100/80"
                          onClick={() => applyResolvedMarketAsset(a)}
                        >
                          <span className="font-medium">{a.displayName}</span>
                          <span className="block text-[10px] text-slate-600">
                            {a.pricingSymbol}
                            {a.isin ? ` · ${a.isin}` : ''} · {a.confidence}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {resolvedAssetCard && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] text-slate-700">
                  <p className="font-semibold text-slate-900">Actif reconnu</p>
                  <p>{resolvedAssetCard.displayName}</p>
                  <p className="tabular-nums">ISIN : {resolvedAssetCard.isin ?? '—'}</p>
                  <p className="tabular-nums">Ticker prix : {resolvedAssetCard.pricingSymbol}</p>
                  <p>
                    Devise : {resolvedAssetCard.currency ?? '—'} · Cotation :{' '}
                    {resolvedAssetCard.exchange ?? '—'}
                  </p>
                  <p>Confiance : {resolvedAssetCard.confidence}</p>
                </div>
              )}
            </div>
          )}

          {mode === 'FEE' && (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <label
                  className="text-xs font-medium text-slate-700"
                  htmlFor="market-order-symbol-fee"
                >
                  Symbole (optionnel)
                </label>
                {symbolUnrecognized && symbol.trim() && (
                  <Badge variant="warning" size="sm">
                    Symbole non reconnu
                  </Badge>
                )}
              </div>
              <MarketOrderSymbolCombobox
                id="market-order-symbol-fee"
                value={symbol}
                onInputChange={handleSymbolInputChange}
                onSelectCandidate={onPickSymbolCandidate}
                candidates={symbolCandidates}
                disabled={!organizationId}
                placeholder="Rechercher ou laisser vide (frais globaux)"
                onRequestOnlineSearch={() => void handleOnlineSymbolSearch()}
                onlineSearchLoading={onlineSearchBusy}
              />
              {assetDisplayName && symbol.trim() !== '' && (
                <p className="text-[11px] leading-snug text-slate-600">{assetDisplayName}</p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {(mode === 'BUY' || mode === 'SELL') && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Quantité</label>
                  <Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs font-medium text-slate-700">Cours unitaire</label>
                    {priceSource === 'historical' && historicalPointDate && (
                      <Badge variant="secondary" size="sm">
                        Cours historique ({formatHistoricalBadgeDate(historicalPointDate)})
                      </Badge>
                    )}
                    {(priceSource === 'market_cache' || priceSource === 'recommendation') && (
                      <Badge variant="secondary" size="sm">
                        Cours actuel
                      </Badge>
                    )}
                    {priceSource === 'manual' && (
                      <Badge variant="primary" size="sm">
                        Prix manuel
                      </Badge>
                    )}
                    {priceSource === 'missing' && symbol.trim() !== '' && (
                      <Badge variant="warning" size="sm">
                        Cours indisponible
                      </Badge>
                    )}
                  </div>
                  <Input
                    inputMode="decimal"
                    placeholder="€"
                    value={unitPrice}
                    onChange={(e) => {
                      const v = e.target.value;
                      setUnitPrice(v);
                      if (v.trim() === '') {
                        manualPriceLockNormRef.current = null;
                        void applyAutoUnitPrice(symbol, date);
                        return;
                      }
                      setPriceSource('manual');
                      setHistoricalPointDate(null);
                      setHistoryFallbackHint(false);
                      setPriceManualHint(null);
                      const n = normalizeMarketStorageSymbol(symbol.trim());
                      manualPriceLockNormRef.current = n || null;
                    }}
                  />
                  {historyFallbackHint && priceSource === 'market_cache' && (
                    <p className="text-[11px] leading-snug text-slate-500">
                      Prix historique non disponible pour cette date.
                    </p>
                  )}
                  {priceManualHint && (
                    <p className="text-[11px] leading-snug text-amber-900">{priceManualHint}</p>
                  )}
                  {priceSource === 'missing' && symbol.trim() !== '' && (
                    <p className="text-[11px] leading-snug text-slate-600">
                      Cours non disponible — actualisez les données marché ou saisissez le prix.
                    </p>
                  )}
                  {priceSource === 'missing' && symbol.trim() !== '' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1 h-8 w-full text-xs"
                      disabled={refreshingPrice || !organizationId}
                      onClick={() => void onRefreshMarketPrice()}
                    >
                      {refreshingPrice ? 'Actualisation…' : 'Actualiser ce cours'}
                    </Button>
                  )}
                  {refreshPriceError && (
                    <p className="text-[11px] text-amber-900">{refreshPriceError}</p>
                  )}
                </div>
              </div>
              {computedGross != null && (
                <p className="rounded-lg border border-violet-100 bg-violet-50 px-2 py-1.5 text-xs text-violet-900">
                  Montant brut calculé :{' '}
                  <span className="font-semibold tabular-nums">
                    {computedGross.toLocaleString('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    €
                  </span>{' '}
                  (= quantité × cours)
                </p>
              )}
              {mode === 'SELL' && heldQty != null && (
                <p className="text-xs text-slate-600">
                  Quantité détenue (après ordres) :{' '}
                  <span className="font-semibold tabular-nums">{heldQty.toFixed(6)}</span>
                </p>
              )}
              {sellExceedsHeld && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                  Vente refusée : la quantité dépasse le stock sur ce compte et ce symbole. Ajustez
                  la quantité ou l’historique (import / survente passée reste signalée côté moteur).
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Frais</label>
                  <Input
                    inputMode="decimal"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">
                    Taxes / impôts saisis
                  </label>
                  <Input
                    inputMode="decimal"
                    value={taxes}
                    onChange={(e) => setTaxes(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {mode === 'DIVIDEND' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Montant brut</label>
                <Input
                  inputMode="decimal"
                  value={dividendGross}
                  onChange={(e) => setDividendGross(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Prélèvements / taxes</label>
                  <Input
                    inputMode="decimal"
                    value={taxes}
                    onChange={(e) => setTaxes(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Frais</label>
                  <Input
                    inputMode="decimal"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {mode === 'FEE' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Montant des frais</label>
              <Input
                inputMode="decimal"
                placeholder="€"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Note</label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={saving || !accountId || sellInvalid || (mode === 'SELL' && sellExceedsHeld)}
            onClick={() => void submit()}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
