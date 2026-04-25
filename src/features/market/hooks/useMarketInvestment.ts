'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeRecommendation, resolveMarketStatus } from '@/features/market/services/marketDecisionService';
import {
  getMarketProviderConfigState,
  mapMarketProviderErrorToMessage,
  type MarketHistoryPoint,
  marketDataService,
} from '@/features/market/services/marketDataService';
import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';
import { ETF_REFERENCE_ALIASES, resolveMarketSymbol } from '@/features/market/marketSymbolAliases';
import { shouldSuppressSuggestion } from '@/features/market/services/marketSuggestionPolicy';
import type { InvestmentRecommendation, InvestmentSettings, MarketSnapshot } from '@/features/market/types';
import { toast } from 'sonner';

interface UpdateSettingsInput extends Partial<InvestmentSettings> {}
export const MARKET_PRESET_TTL_HOURS = 12;

export interface MarketRadarEntry {
  label: string;
  symbol: string;
  snapshot: MarketSnapshot | null;
  recommendation: InvestmentRecommendation | null;
  isActive: boolean;
}

export function useMarketInvestment(organizationId?: string) {
  const fallbackErrorMessage = 'Données marché indisponibles — saisie manuelle possible';
  const isDev = process.env.NODE_ENV === 'development';
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof marketInvestmentStorage.listActionLogs>>>([]);
  const [loading, setLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [lastRefreshAttemptAt, setLastRefreshAttemptAt] = useState<string | null>(null);
  const [lastRefreshError, setLastRefreshError] = useState<string | null>(null);
  const [lastAttemptedProviders, setLastAttemptedProviders] = useState<string[]>([]);
  const [lastUsedProvider, setLastUsedProvider] = useState<string | null>(null);
  const [lastProviderSymbol, setLastProviderSymbol] = useState<string | null>(null);
  const [lastFallbackError, setLastFallbackError] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<MarketHistoryPoint[]>([]);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);
  const [refreshStartedAt, setRefreshStartedAt] = useState<string | null>(null);
  const [refreshCompletedAt, setRefreshCompletedAt] = useState<string | null>(null);
  const [lastSuccessfulRefreshAt, setLastSuccessfulRefreshAt] = useState<string | null>(null);
  const [lastRefreshStatus, setLastRefreshStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [suppressedSuggestion, setSuppressedSuggestion] = useState(false);
  const [manualAnalysisAt, setManualAnalysisAt] = useState<number | null>(null);
  const [isRefreshingAfterEtfChange, setIsRefreshingAfterEtfChange] = useState(false);
  const [radarSnapshots, setRadarSnapshots] = useState<Record<string, MarketSnapshot>>({});
  const [isRefreshingRadar, setIsRefreshingRadar] = useState(false);
  const [radarRefreshNote, setRadarRefreshNote] = useState<string | null>(null);
  const [radarRefreshMode, setRadarRefreshMode] = useState<'idle' | 'manual-forced' | 'auto' | 'skipped-fresh' | 'error'>('idle');
  const [radarLastRefreshedAt, setRadarLastRefreshedAt] = useState<string | null>(null);
  const hasTriedAutoRefreshRef = useRef(false);
  const previousStatusRef = useRef<string | null>(null);
  const activeOpportunityToastIdRef = useRef<string | null>(null);
  const activeRadarToastIdRef = useRef<string | null>(null);
  const radarRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const previousRadarOpportunityKeyRef = useRef<string>('');
  const refreshInFlightByKeyRef = useRef<Map<string, Promise<void>>>(new Map());
  const historyInFlightByKeyRef = useRef<Map<string, Promise<void>>>(new Map());
  const historyLoadedKeyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const loadedSettings = await marketInvestmentStorage.getSettings(organizationId);
    const loadedSnapshot = await marketInvestmentStorage.getSnapshot(organizationId, loadedSettings.referenceSymbol);
    const presetSymbols = ETF_REFERENCE_ALIASES.map((item) => item.defaultProviderSymbol);
    const loadedRadarSnapshots = await marketInvestmentStorage.listSnapshots(organizationId, presetSymbols);
    const loadedHistory = await marketInvestmentStorage.listActionLogs(organizationId, 12);
    const radarMap = loadedRadarSnapshots.reduce<Record<string, MarketSnapshot>>((acc, row) => {
      acc[row.symbol] = row;
      return acc;
    }, {});
    setSettings(loadedSettings);
    setSnapshot(loadedSnapshot);
    setRadarSnapshots(radarMap);
    const latestRadarSnapshot = loadedRadarSnapshots
      .slice()
      .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0];
    setRadarLastRefreshedAt(latestRadarSnapshot?.fetchedAt ?? null);
    setHistory(loadedHistory);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const recommendation = useMemo(() => {
    if (!settings || !snapshot) return null;
    return computeRecommendation(settings, snapshot);
  }, [settings, snapshot]);

  const refreshRadar = useCallback(
    async (options?: { force?: boolean; reason?: 'auto' | 'manual' | 'page-load' }) => {
      if (!organizationId || !settings) return;
      const force = options?.force ?? false;
      const presetSymbols = ETF_REFERENCE_ALIASES.map((item) => item.defaultProviderSymbol);
      const ttlMs = MARKET_PRESET_TTL_HOURS * 60 * 60 * 1000;
      const allFresh =
        presetSymbols.length > 0 &&
        presetSymbols.every((symbol) => {
          const existing = radarSnapshots[symbol];
          if (!existing) return false;
          return Date.now() - new Date(existing.fetchedAt).getTime() <= ttlMs;
        });
      if (!force && allFresh) {
        const freshestTimestamp = presetSymbols
          .map((symbol) => radarSnapshots[symbol]?.fetchedAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1);
        const nextAutoRefreshInMs = freshestTimestamp
          ? Math.max(0, ttlMs - (Date.now() - new Date(freshestTimestamp).getTime()))
          : ttlMs;
        const nextAutoRefreshInHours = Math.max(1, Math.ceil(nextAutoRefreshInMs / (60 * 60 * 1000)));
        setRadarRefreshMode('skipped-fresh');
        setRadarRefreshNote(`Données déjà à jour — prochaine actualisation automatique dans ${nextAutoRefreshInHours} h.`);
        return;
      }
      if (radarRefreshInFlightRef.current) {
        await radarRefreshInFlightRef.current;
        return;
      }

      const run = (async () => {
        setIsRefreshingRadar(true);
        setRadarRefreshMode(force ? 'manual-forced' : 'auto');
        setRadarRefreshNote('Actualisation des données marché en cours…');
        if (options?.reason === 'manual') {
          setRadarRefreshMode('manual-forced');
          setRadarRefreshNote('Actualisation forcée demandée. Les appels sont limités pour éviter les restrictions API.');
        }
        try {
          const statuses = await marketDataService.fetchPresetEtfStatuses({
            athPeriod: settings.athPeriod,
            reinforce10Threshold: settings.reinforce10Threshold,
            reinforce20Threshold: settings.reinforce20Threshold,
          });
          const now = new Date().toISOString();
          const nextRadarMap = { ...radarSnapshots };
          for (const row of statuses) {
            if (
              typeof row.currentPrice !== 'number' ||
              !Number.isFinite(row.currentPrice) ||
              typeof row.athPrice !== 'number' ||
              !Number.isFinite(row.athPrice) ||
              row.currentPrice <= 0 ||
              row.athPrice <= 0
            ) {
              continue;
            }
            const snapshotRow: MarketSnapshot = {
              id: `${organizationId}:${row.symbol}`,
              organizationId,
              symbol: row.symbol,
              currentPrice: row.currentPrice,
              athPrice: row.athPrice,
              drawdownPercent: row.drawdownPercent ?? 0,
              athDate: null,
              fetchedAt: now,
              source: 'yahoo-api',
            };
            await marketInvestmentStorage.saveSnapshot(snapshotRow);
            nextRadarMap[row.symbol] = snapshotRow;
          }
          setRadarSnapshots(nextRadarMap);
          setRadarLastRefreshedAt(now);
        } catch {
          setRadarRefreshMode('error');
          setRadarRefreshNote('Limite de récupération atteinte. Réessayez plus tard ou utilisez la saisie manuelle.');
          throw new Error('RADAR_REFRESH_FAILED');
        } finally {
          setIsRefreshingRadar(false);
          if (options?.reason === 'manual' || options?.force) {
            window.setTimeout(() => setRadarRefreshNote(null), 5000);
          } else {
            setRadarRefreshNote(null);
          }
        }
      })();

      radarRefreshInFlightRef.current = run;
      try {
        await run;
      } finally {
        radarRefreshInFlightRef.current = null;
      }
    },
    [organizationId, radarSnapshots, settings]
  );

  const refreshSnapshot = useCallback(async (nextSettings?: InvestmentSettings, reason: 'default' | 'etf-change' = 'default') => {
    const targetSettings = nextSettings ?? settings;
    if (!organizationId || !targetSettings) return;
    const providerSymbol = resolveMarketSymbol(targetSettings.referenceSymbol);
    const requestKey = `${providerSymbol}::${targetSettings.athPeriod}`;
    const existingRefresh = refreshInFlightByKeyRef.current.get(requestKey);
    if (existingRefresh) {
      await existingRefresh;
      return;
    }

    const run = (async () => {
    const startedAtIso = new Date().toISOString();
    setIsRefreshingMarket(true);
    setRefreshStartedAt(startedAtIso);
    setLastRefreshAttemptAt(startedAtIso);
    setLastRefreshStatus('loading');
    try {
      const fetched = await marketDataService.fetchMarketSnapshot({
        symbol: providerSymbol,
        athPeriod: targetSettings.athPeriod,
      });
      await marketInvestmentStorage.saveSnapshot({ ...fetched.snapshot, organizationId });
      setSnapshot({ ...fetched.snapshot, organizationId });
      setMarketError(null);
      setLastRefreshError(null);
      setLastAttemptedProviders(fetched.diagnostics.attemptedProviders);
      setLastUsedProvider(fetched.diagnostics.usedProvider);
      setLastProviderSymbol(fetched.diagnostics.providerSymbol);
      setLastFallbackError(fetched.diagnostics.fallbackError ?? null);
      const nextHistory = await marketDataService.fetchYahooHistory({
        symbol: providerSymbol,
        athPeriod: targetSettings.athPeriod,
      });
      setPriceHistory(nextHistory);
      historyLoadedKeyRef.current = `${providerSymbol}::${targetSettings.athPeriod}::${fetched.snapshot.fetchedAt}`;
      const completedAtIso = new Date().toISOString();
      setRefreshCompletedAt(completedAtIso);
      setLastSuccessfulRefreshAt(completedAtIso);
      setLastRefreshStatus('success');
    } catch (error) {
      const mapped =
        reason === 'etf-change'
          ? 'Impossible de récupérer les données de ce nouvel ETF. Vous pouvez saisir les prix manuellement.'
          : mapMarketProviderErrorToMessage(error);
      setMarketError(mapped);
      setLastRefreshError(mapped);
      const diagnostics = marketDataService.getProviderAttemptDiagnostics(error);
      if (diagnostics) {
        setLastAttemptedProviders(diagnostics.attemptedProviders);
        setLastProviderSymbol(diagnostics.providerSymbol || null);
        setLastFallbackError(diagnostics.fallbackError ?? null);
      }
      setLastUsedProvider(null);
      setRefreshCompletedAt(new Date().toISOString());
      setLastRefreshStatus('error');
      if (isDev) {
        console.warn('[MarketRefresh] Erreur refresh', {
          symbol: providerSymbol,
          athPeriod: targetSettings.athPeriod,
          message: mapped,
          error,
        });
      }
    } finally {
      setIsRefreshingMarket(false);
    }
    })();

    refreshInFlightByKeyRef.current.set(requestKey, run);
    try {
      await run;
    } finally {
      refreshInFlightByKeyRef.current.delete(requestKey);
    }
  }, [isDev, organizationId, settings]);

  useEffect(() => {
    if (!organizationId || !settings) return;
    if (hasTriedAutoRefreshRef.current) return;
    if (!snapshot) {
      hasTriedAutoRefreshRef.current = true;
      refreshSnapshot().catch(() => {
        setMarketError(fallbackErrorMessage);
      });
      return;
    }
    const age = Date.now() - new Date(snapshot.fetchedAt).getTime();
    if (age <= 24 * 60 * 60 * 1000) {
      hasTriedAutoRefreshRef.current = true;
      return;
    }
    hasTriedAutoRefreshRef.current = true;
    refreshSnapshot().catch(() => {
      setMarketError(fallbackErrorMessage);
    });
  }, [fallbackErrorMessage, organizationId, refreshSnapshot, settings, snapshot]);

  useEffect(() => {
    if (!organizationId || !settings) return;
    refreshRadar({ force: false, reason: 'page-load' }).catch(() => undefined);
  }, [organizationId, refreshRadar, settings]);

  useEffect(() => {
    if (!settings || !snapshot || snapshot.source === 'manual') {
      setPriceHistory([]);
      historyLoadedKeyRef.current = null;
      return;
    }
    const providerSymbol = resolveMarketSymbol(settings.referenceSymbol);
    const historyKey = `${providerSymbol}::${settings.athPeriod}::${snapshot.fetchedAt}`;
    if (historyLoadedKeyRef.current === historyKey) return;
    const existingHistoryRequest = historyInFlightByKeyRef.current.get(historyKey);
    if (existingHistoryRequest) {
      return;
    }

    const request = marketDataService
      .fetchYahooHistory({ symbol: providerSymbol, athPeriod: settings.athPeriod })
      .then((history) => {
        setPriceHistory(history);
        historyLoadedKeyRef.current = historyKey;
      })
      .catch(() => {
        setPriceHistory([]);
      })
      .finally(() => {
        historyInFlightByKeyRef.current.delete(historyKey);
      });
    historyInFlightByKeyRef.current.set(historyKey, request);
  }, [settings, snapshot]);

  const saveManualSnapshot = useCallback(
    async (input: { currentPrice: number; athPrice: number; athDate?: string }) => {
      if (!organizationId || !settings) return;
      const manual = marketDataService.createManualSnapshot({
        organizationId,
        symbol: resolveMarketSymbol(settings.referenceSymbol),
        currentPrice: input.currentPrice,
        athPrice: input.athPrice,
        athDate: input.athDate,
        source: 'manual',
      });
      await marketInvestmentStorage.saveSnapshot(manual);
      setSnapshot(manual);
      setMarketError(null);
      setPriceHistory([]);

      const status = resolveMarketStatus(manual.drawdownPercent, settings);
      if (status === 'OPPORTUNITE' || status === 'FORTE_OPPORTUNITE') {
        await marketInvestmentStorage.addAlertIfMissing({
          organizationId,
          symbol: manual.symbol,
          level: status,
          drawdownPercent: manual.drawdownPercent,
        });
      }
    },
    [organizationId, settings]
  );

  const updateSettings = useCallback(
    async (patch: UpdateSettingsInput) => {
      if (!settings) return;
      const next = { ...settings, ...patch, updatedAt: new Date().toISOString() };
      await marketInvestmentStorage.saveSettings(next);
      setSettings(next);

      const etfChanged =
        settings.referenceSymbol !== next.referenceSymbol ||
        settings.referenceLabel !== next.referenceLabel ||
        settings.athPeriod !== next.athPeriod;
      if (!etfChanged) return;

      // Invalidate currently displayed data to avoid showing previous ETF values.
      setSnapshot(null);
      setPriceHistory([]);
      setMarketError(null);
      setIsRefreshingAfterEtfChange(true);
      try {
        await refreshSnapshot(next, 'etf-change');
      } finally {
        setIsRefreshingAfterEtfChange(false);
      }
    },
    [refreshSnapshot, settings]
  );

  const validateDecision = useCallback(
    async (validatedAmount: number, reason?: string, note?: string) => {
      if (!organizationId || !settings || !snapshot || !recommendation) return;
      const cashBefore = settings.availableCash;
      const amount = Math.max(0, Math.min(validatedAmount, cashBefore));
      const cashAfter = cashBefore - amount;
      const thresholdKey = recommendation.thresholdKey;
      const resolvedReason = (reason?.trim() || recommendation.reason).slice(0, 220);

      const nextSettings = { ...settings, availableCash: cashAfter, updatedAt: new Date().toISOString() };
      await marketInvestmentStorage.saveSettings(nextSettings);
      await marketInvestmentStorage.addActionLog(
        marketInvestmentStorage.buildActionLog({
          organizationId,
          type: amount === recommendation.suggestedAmount ? recommendation.actionType : 'MANUAL',
          recommendedAmount: recommendation.suggestedAmount,
          validatedAmount: amount,
          cashBefore,
          cashAfter,
          reason: resolvedReason,
          drawdownAtDecision: snapshot.drawdownPercent,
          athPriceAtDecision: snapshot.athPrice,
          currentPriceAtDecision: snapshot.currentPrice,
          symbolAtDecision: snapshot.symbol,
          marketStatusAtDecision: recommendation.status,
          athPeriodAtDecision: settings.athPeriod,
          status: 'validated',
          thresholdKey,
          marketLevelKey: recommendation.status,
          drawdownPercentAtAction: snapshot.drawdownPercent,
          note,
        })
      );

      setSettings(nextSettings);
      setHistory(await marketInvestmentStorage.listActionLogs(organizationId, 12));
    },
    [organizationId, recommendation, settings, snapshot]
  );

  const ignoreDecision = useCallback(async () => {
    if (!organizationId || !settings || !snapshot || !recommendation) return;
    await marketInvestmentStorage.addActionLog(
      marketInvestmentStorage.buildActionLog({
        organizationId,
        type: recommendation.actionType,
        recommendedAmount: recommendation.suggestedAmount,
        validatedAmount: 0,
        cashBefore: settings.availableCash,
        cashAfter: settings.availableCash,
        reason: recommendation.reason,
        drawdownAtDecision: snapshot.drawdownPercent,
        athPriceAtDecision: snapshot.athPrice,
        currentPriceAtDecision: snapshot.currentPrice,
        symbolAtDecision: snapshot.symbol,
        marketStatusAtDecision: recommendation.status,
        athPeriodAtDecision: settings.athPeriod,
        status: 'ignored',
        thresholdKey: recommendation.thresholdKey,
        marketLevelKey: recommendation.status,
        drawdownPercentAtAction: snapshot.drawdownPercent,
      })
    );
    setHistory(await marketInvestmentStorage.listActionLogs(organizationId, 12));
  }, [organizationId, recommendation, settings, snapshot]);

  useEffect(() => {
    if (!organizationId || !recommendation?.thresholdKey) {
      setSuppressedSuggestion(false);
      return;
    }
    marketInvestmentStorage
      .getLatestThresholdDecision(organizationId, recommendation.thresholdKey)
      .then((latest) => {
        if (!latest) {
          setSuppressedSuggestion(false);
          return;
        }
        setSuppressedSuggestion(
          shouldSuppressSuggestion({
            latestDecision: latest,
            currentDrawdownPercent: snapshot?.drawdownPercent ?? 0,
            manualAnalysisAt,
          })
        );
      })
      .catch(() => setSuppressedSuggestion(false));
  }, [manualAnalysisAt, organizationId, recommendation, recommendation?.thresholdKey, snapshot?.drawdownPercent]);

  useEffect(() => {
    if (!organizationId || !recommendation || !snapshot) return;
    const currentStatus = recommendation.status;
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = currentStatus;
    const isOpportunity = currentStatus === 'OPPORTUNITE' || currentStatus === 'FORTE_OPPORTUNITE';
    const transitionedFromNormal = previousStatus === 'NORMAL' || previousStatus === null;
    if (!isOpportunity || !transitionedFromNormal || !recommendation.thresholdKey) return;

    marketInvestmentStorage
      .addAlertIfMissing({
        organizationId,
        symbol: snapshot.symbol,
        level: currentStatus,
        drawdownPercent: snapshot.drawdownPercent,
      })
      .catch(() => undefined);

    const toastId = `market-opportunity-${snapshot.symbol}-${recommendation.thresholdKey}`;
    if (activeOpportunityToastIdRef.current && activeOpportunityToastIdRef.current !== toastId) {
      toast.dismiss(activeOpportunityToastIdRef.current);
    }
    activeOpportunityToastIdRef.current = toastId;
    toast(messageForStatus(currentStatus, snapshot.drawdownPercent), {
      id: toastId,
      duration: 3500,
    });
  }, [organizationId, recommendation, snapshot]);

  const requestManualAnalysis = useCallback(() => {
    setManualAnalysisAt(Date.now());
    setSuppressedSuggestion(false);
  }, []);

  const refreshAllMarketData = useCallback(async () => {
    await Promise.all([
      refreshSnapshot(undefined, 'default'),
      refreshRadar({ force: true, reason: 'manual' }),
    ]);
  }, [refreshRadar, refreshSnapshot]);

  const providerConfig = useMemo(() => getMarketProviderConfigState(), []);
  const radarEntries = useMemo<MarketRadarEntry[]>(() => {
    if (!settings) return [];
    return ETF_REFERENCE_ALIASES.map((alias) => {
      const row = radarSnapshots[alias.defaultProviderSymbol] ?? null;
      const recommendationForRow = row ? computeRecommendation(settings, row) : null;
      const isActive =
        resolveMarketSymbol(settings.referenceSymbol) === resolveMarketSymbol(alias.defaultProviderSymbol) ||
        settings.referenceSymbol === alias.defaultProviderSymbol;
      return {
        label: alias.label,
        symbol: alias.defaultProviderSymbol,
        snapshot: row,
        recommendation: recommendationForRow,
        isActive,
      };
    });
  }, [radarSnapshots, settings]);

  useEffect(() => {
    if (!organizationId || !settings || radarEntries.length === 0) return;
    const opportunities = radarEntries.filter(
      (entry) =>
        entry.snapshot &&
        entry.recommendation &&
        (entry.recommendation.status === 'OPPORTUNITE' || entry.recommendation.status === 'FORTE_OPPORTUNITE')
    ) as Array<MarketRadarEntry & { snapshot: MarketSnapshot; recommendation: InvestmentRecommendation }>;
    const opportunitySymbols = opportunities.map((entry) => entry.symbol).sort();
    const key = opportunitySymbols.join(',');
    if (!key) {
      if (activeRadarToastIdRef.current) {
        toast.dismiss(activeRadarToastIdRef.current);
        activeRadarToastIdRef.current = null;
      }
      previousRadarOpportunityKeyRef.current = key;
      return;
    }
    if (key === previousRadarOpportunityKeyRef.current) {
      previousRadarOpportunityKeyRef.current = key;
      return;
    }
    previousRadarOpportunityKeyRef.current = key;

    opportunities.forEach((entry) => {
      marketInvestmentStorage
        .addAlertIfMissing({
          organizationId,
          symbol: entry.symbol,
          level: entry.recommendation.status as 'OPPORTUNITE' | 'FORTE_OPPORTUNITE',
          drawdownPercent: entry.snapshot.drawdownPercent,
        })
        .catch(() => undefined);
    });

    const dateKey = new Date().toISOString().slice(0, 10);
    const toastId = `market-radar-opportunity-${dateKey}-${opportunitySymbols.join('-')}`;
    if (activeRadarToastIdRef.current && activeRadarToastIdRef.current !== toastId) {
      toast.dismiss(activeRadarToastIdRef.current);
    }
    activeRadarToastIdRef.current = toastId;
    toast(
      opportunitySymbols.length === 1
        ? 'Opportunité marché détectée sur 1 ETF'
        : `Opportunités marché détectées sur ${opportunitySymbols.length} ETF`,
      {
        id: toastId,
        duration: 3500,
      }
    );
  }, [organizationId, radarEntries, settings]);

  return {
    settings,
    snapshot,
    history,
    loading,
    marketError,
    fallbackErrorMessage,
    providerConfig,
    lastRefreshAttemptAt,
    lastRefreshError,
    lastAttemptedProviders,
    lastUsedProvider,
    lastProviderSymbol,
    lastFallbackError,
    isRefreshingMarket,
    refreshStartedAt,
    refreshCompletedAt,
    lastSuccessfulRefreshAt,
    lastRefreshStatus,
    isRefreshingAfterEtfChange,
    isRefreshingRadar,
    radarRefreshNote,
    radarRefreshMode,
    radarLastRefreshedAt,
    recommendation,
    radarEntries,
    priceHistory,
    suppressedSuggestion,
    refreshSnapshot,
    refreshAllMarketData,
    refreshRadar,
    saveManualSnapshot,
    updateSettings,
    validateDecision,
    ignoreDecision,
    requestManualAnalysis,
    reload: load,
  };
}

function messageForStatus(status: 'OPPORTUNITE' | 'FORTE_OPPORTUNITE', drawdownPercent: number): string {
  if (status === 'FORTE_OPPORTUNITE') {
    return `Forte opportunité marché détectée (${drawdownPercent.toFixed(1)}%).`;
  }
  return `Opportunité marché détectée (${drawdownPercent.toFixed(1)}%).`;
}
