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
  const historyLoadedKeyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const loadedSettings = await marketInvestmentStorage.getSettings(organizationId);
    const presetSymbols = ETF_REFERENCE_ALIASES.map((item) => item.defaultProviderSymbol);
    const loadedRadarSnapshots = await marketInvestmentStorage.listSnapshots(organizationId, presetSymbols);
    const loadedHistory = await marketInvestmentStorage.listActionLogs(organizationId, 12);
    const radarMap = loadedRadarSnapshots.reduce<Record<string, MarketSnapshot>>((acc, row) => {
      acc[row.symbol] = row;
      return acc;
    }, {});
    setSettings(loadedSettings);
    setRadarSnapshots(radarMap);
    const activeLocalSnapshot = radarMap[loadedSettings.referenceSymbol] ?? null;
    setSnapshot(activeLocalSnapshot);
    setPriceHistory([]);
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
        setRadarRefreshNote(`Données à jour — prochaine actualisation automatique dans ${nextAutoRefreshInHours} h`);
        return;
      }
      if (radarRefreshInFlightRef.current) {
        await radarRefreshInFlightRef.current;
        return;
      }

      const run = (async () => {
        setIsRefreshingRadar(true);
        setRadarRefreshMode(force ? 'manual-forced' : 'auto');
        setRadarRefreshNote('Actualisation des données marché…');
        if (options?.reason === 'manual') {
          setRadarRefreshMode('manual-forced');
          setRadarRefreshNote('Actualisation forcée — requête API en cours');
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
          const activeLocalSnapshot = nextRadarMap[settings.referenceSymbol] ?? null;
          setSnapshot(activeLocalSnapshot);
          if (activeLocalSnapshot) {
            setMarketError(null);
          }
          setPriceHistory([]);
        } catch {
          setRadarRefreshMode('error');
          setRadarRefreshNote('Limite atteinte — réessayez plus tard');
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

  useEffect(() => {
    if (!organizationId || !settings) return;
    if (hasTriedAutoRefreshRef.current) return;
    hasTriedAutoRefreshRef.current = true;
    setIsRefreshingMarket(true);
    const startedAtIso = new Date().toISOString();
    setRefreshStartedAt(startedAtIso);
    setLastRefreshAttemptAt(startedAtIso);
    setLastRefreshStatus('loading');
    refreshRadar({ force: false, reason: 'page-load' })
      .then(() => {
        const completedAtIso = new Date().toISOString();
        setRefreshCompletedAt(completedAtIso);
        setLastSuccessfulRefreshAt(completedAtIso);
        setLastRefreshStatus('success');
      })
      .catch(() => {
        setLastRefreshError(fallbackErrorMessage);
        setLastRefreshStatus('error');
      })
      .finally(() => {
        setIsRefreshingMarket(false);
      });
  }, [organizationId, refreshRadar, settings]);

  useEffect(() => {
    if (!settings) return;
    const activeLocalSnapshot = radarSnapshots[settings.referenceSymbol] ?? null;
    setSnapshot(activeLocalSnapshot);
    setPriceHistory([]);
    historyLoadedKeyRef.current = null;
    if (!activeLocalSnapshot) {
      setMarketError('Données indisponibles localement — cliquez sur Actualiser');
      return;
    }
    setMarketError(null);
  }, [radarSnapshots, settings]);

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

      setIsRefreshingAfterEtfChange(false);
      const nextLocalSnapshot = radarSnapshots[next.referenceSymbol] ?? null;
      setSnapshot(nextLocalSnapshot);
      setPriceHistory([]);
      if (!nextLocalSnapshot) {
        setMarketError('Données indisponibles localement — cliquez sur Actualiser');
      } else {
        setMarketError(null);
      }
    },
    [radarSnapshots, settings]
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
    if (!recommendation) return;
    previousStatusRef.current = recommendation.status;
  }, [recommendation]);

  const requestManualAnalysis = useCallback(() => {
    setManualAnalysisAt(Date.now());
    setSuppressedSuggestion(false);
  }, []);

  const refreshAllMarketData = useCallback(async () => {
    const startedAtIso = new Date().toISOString();
    setIsRefreshingMarket(true);
    setRefreshStartedAt(startedAtIso);
    setLastRefreshAttemptAt(startedAtIso);
    setLastRefreshStatus('loading');
    try {
      await refreshRadar({ force: true, reason: 'manual' });
      const completedAtIso = new Date().toISOString();
      setRefreshCompletedAt(completedAtIso);
      setLastSuccessfulRefreshAt(completedAtIso);
      setLastRefreshStatus('success');
      setLastRefreshError(null);
    } catch (error) {
      const mapped = mapMarketProviderErrorToMessage(error);
      setMarketError(mapped);
      setLastRefreshError(mapped);
      setLastRefreshStatus('error');
    } finally {
      setIsRefreshingMarket(false);
    }
  }, [refreshRadar]);

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
    refreshSnapshot: refreshAllMarketData,
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
