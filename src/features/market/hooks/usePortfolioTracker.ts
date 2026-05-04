'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { portfolioStorage } from '@/features/market/portfolio/portfolioStorage';
import {
  computePortfolioFromOrders,
  PORTFOLIO_PRICE_FRESH_MAX_MS,
  type PriceLookup,
} from '@/features/market/portfolio/portfolioLedgerEngine';
import { estimatePortfolioTaxSimple } from '@/features/market/portfolio/portfolioFiscalEstimate';
import { surplusVsInflationEuro } from '@/features/market/portfolio/portfolioInflationEstimate';
import { fetchPortfolioPriceLookup } from '@/features/market/portfolio/portfolioPriceLookup';
import type { InvestmentSettings } from '@/features/market/types';
import type {
  PortfolioAccount,
  PortfolioAccountKind,
  PortfolioOrder,
  PortfolioSnapshot,
} from '@/features/market/portfolio/portfolioTypes';
import { createPortfolioSnapshot } from '@/features/market/portfolio/createPortfolioSnapshot';
import { isPortfolioSnapshotOnVolatilityEnabled } from '@/features/market/portfolio/portfolioSnapshotGuards';
import { PORTFOLIO_CASH_MUTATED_EVENT } from '@/features/market/portfolio/portfolioSnapshotTriggers';
import { buildPortfolioPrincipalOverlay } from '@/features/market/portfolio/portfolioAdvice';
import type { PortfolioAdviceOverlay } from '@/features/market/services/marketDecisionV2';

const DEFAULT_INFLATION = 0.02;

export function usePortfolioTracker(organizationId: string | undefined, settings: InvestmentSettings | null) {
  const [accounts, setAccounts] = useState<PortfolioAccount[]>([]);
  const [orders, setOrders] = useState<PortfolioOrder[]>([]);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const [ac, or, sn] = await Promise.all([
      portfolioStorage.listAccounts(organizationId),
      portfolioStorage.listOrders(organizationId),
      portfolioStorage.listSnapshots(organizationId),
    ]);
    setAccounts(ac);
    setOrders(or);
    setSnapshots(sn);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onSync = (ev: Event) => {
      const d = (ev as CustomEvent<{ organizationId?: string }>).detail;
      if (d?.organizationId && d.organizationId !== organizationId) return;
      void load();
    };
    if (typeof window === 'undefined') return;
    window.addEventListener('sync:refresh', onSync);
    return () => window.removeEventListener('sync:refresh', onSync);
  }, [load, organizationId]);

  const priceLookup = useMemo(() => {
    return async (): Promise<PriceLookup> => {
      if (!organizationId) return { bySymbol: {}, metaBySymbol: {} };
      return fetchPortfolioPriceLookup(organizationId, orders, settings);
    };
  }, [organizationId, orders, settings]);

  const [prices, setPrices] = useState<PriceLookup>({ bySymbol: {} });

  useEffect(() => {
    void priceLookup().then(setPrices);
  }, [priceLookup]);

  const captureSnapshot = useCallback(async () => {
    if (!organizationId) return;
    setSnapshotting(true);
    try {
      await createPortfolioSnapshot({
        organizationId,
        settings,
        mode: 'manual',
      });
      const sn = await portfolioStorage.listSnapshots(organizationId);
      setSnapshots(sn);
    } finally {
      setSnapshotting(false);
    }
  }, [organizationId, settings]);

  const runAutoSnapshot = useCallback(
    async (autoKind: 'order' | 'cash') => {
      if (!organizationId) return;
      await createPortfolioSnapshot({
        organizationId,
        settings,
        mode: 'auto',
        autoKind,
      });
      const sn = await portfolioStorage.listSnapshots(organizationId);
      setSnapshots(sn);
    },
    [organizationId, settings]
  );

  const maybeCaptureDailySnapshot = useCallback(async () => {
    if (!organizationId) return;
    await createPortfolioSnapshot({
      organizationId,
      settings,
      mode: 'auto',
      autoKind: 'daily',
    });
    const sn = await portfolioStorage.listSnapshots(organizationId);
    setSnapshots(sn);
  }, [organizationId, settings]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const schedule = (kind: 'order' | 'cash') => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void runAutoSnapshot(kind);
      }, 600);
    };
    const onOrdersMutated = (ev: Event) => {
      const d = (ev as CustomEvent<{ organizationId?: string }>).detail;
      if (!organizationId || d?.organizationId !== organizationId) return;
      schedule('order');
    };
    const onCashMutated = (ev: Event) => {
      const d = (ev as CustomEvent<{ organizationId?: string }>).detail;
      if (!organizationId || d?.organizationId !== organizationId) return;
      schedule('cash');
    };
    if (typeof window === 'undefined') return;
    window.addEventListener('portfolio:orders-mutated', onOrdersMutated);
    window.addEventListener(PORTFOLIO_CASH_MUTATED_EVENT, onCashMutated);
    return () => {
      window.removeEventListener('portfolio:orders-mutated', onOrdersMutated);
      window.removeEventListener(PORTFOLIO_CASH_MUTATED_EVENT, onCashMutated);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [organizationId, runAutoSnapshot]);

  const valuation = useMemo(() => {
    const nowMs = Date.now();
    return computePortfolioFromOrders(accounts, orders, prices, {
      nowMs,
      priceFreshMaxAgeMs: PORTFOLIO_PRICE_FRESH_MAX_MS,
    });
  }, [accounts, orders, prices]);

  const fiscalEstimate = useMemo(() => {
    const flat = 0.3;
    const peaRate = settings?.peaSocialContributionsOnGainsRate ?? 0.172;
    return estimatePortfolioTaxSimple({
      incomeLikeByKind: valuation.fiscalIncomeByKind as Partial<
        Record<PortfolioAccountKind, { unrealized: number; realized: number; dividends: number }>
      >,
      fiscal: { flatTaxRateOnIncome: flat, peaSocialContributionsOnGainsRate: peaRate },
    });
  }, [valuation.fiscalIncomeByKind, settings?.peaSocialContributionsOnGainsRate]);

  const fiscalAssumptions = useMemo(
    () => ({
      pfuRateOnIncome: 0.3,
      peaSocialContributionsOnGainsRate: settings?.peaSocialContributionsOnGainsRate ?? 0.172,
    }),
    [settings?.peaSocialContributionsOnGainsRate]
  );

  const inflationAnnual = DEFAULT_INFLATION;
  const surplusInflationEuro = useMemo(() => {
    if (!valuation.totals.totalMarketValue) return 0;
    return surplusVsInflationEuro({
      currentMarketValueTotal: valuation.totals.totalMarketValue,
      orders,
      annualInflationRate: inflationAnnual,
      nowMs: Date.now(),
    });
  }, [orders, valuation.totals.totalMarketValue]);

  const performanceNetFiscalEuro = useMemo(
    () => valuation.totals.grossPerformanceEuro - fiscalEstimate.totalTaxEstimateEuro,
    [fiscalEstimate.totalTaxEstimateEuro, valuation.totals.grossPerformanceEuro]
  );

  const principalOverlay: PortfolioAdviceOverlay | null = useMemo(() => {
    if (!settings) return null;
    return buildPortfolioPrincipalOverlay(settings, valuation.positions, valuation.totals);
  }, [settings, valuation.positions, valuation.totals]);

  const volatilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!organizationId || loading || !isPortfolioSnapshotOnVolatilityEnabled()) return;
    if (volatilityTimerRef.current) clearTimeout(volatilityTimerRef.current);
    volatilityTimerRef.current = setTimeout(() => {
      volatilityTimerRef.current = null;
      void (async () => {
        await createPortfolioSnapshot({
          organizationId,
          settings,
          mode: 'auto',
          autoKind: 'volatility',
        });
        const sn = await portfolioStorage.listSnapshots(organizationId);
        setSnapshots(sn);
      })();
    }, 2000);
    return () => {
      if (volatilityTimerRef.current) clearTimeout(volatilityTimerRef.current);
    };
  }, [organizationId, loading, settings, valuation.totals.totalMarketValue]);

  const lastSnapshotCapturedAt = useMemo(() => {
    if (snapshots.length === 0) return null;
    const last = [...snapshots].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)).at(-1);
    return last?.capturedAt ?? null;
  }, [snapshots]);

  return {
    loading,
    accounts,
    orders,
    reload: load,
    positions: valuation.positions,
    totals: valuation.totals,
    globalWarnings: valuation.globalWarnings,
    fiscalEstimate,
    fiscalAssumptions,
    surplusInflationEuro,
    inflationAnnual,
    performanceNetFiscalEuro,
    principalOverlay,
    /** Prix utilisés pour la valorisation (dernier snapshot connu par symbole). */
    pricesBySymbol: prices.bySymbol,
    priceMetaBySymbol: prices.metaBySymbol ?? {},
    priceFreshMaxAgeMs: PORTFOLIO_PRICE_FRESH_MAX_MS,
    saveAccount: portfolioStorage.saveAccount.bind(portfolioStorage),
    deleteAccount: portfolioStorage.deleteAccount.bind(portfolioStorage),
    saveOrder: portfolioStorage.saveOrder.bind(portfolioStorage),
    deleteOrder: portfolioStorage.deleteOrder.bind(portfolioStorage),
    snapshots,
    captureSnapshot,
    snapshotting,
    maybeCaptureDailySnapshot,
    lastSnapshotCapturedAt,
  };
}
