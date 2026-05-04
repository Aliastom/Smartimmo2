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
import {
  ETF_REFERENCE_ALIASES,
  MARKET_CACHE_ATH_PERIODS,
  marketSnapshotCacheKey,
  normalizeMarketStorageSymbol,
} from '@/features/market/marketSymbolAliases';
import {
  buildFullTrackableLibrarySymbols,
  buildMarketRefreshSymbols,
  buildMarketSnapshotKeepSet,
  mergeUniqueMarketRefreshSymbols,
  readMarketCompareSymbols,
  readRecentPrincipalSymbols,
  type MarketLastRefreshScope,
} from '@/features/market/marketRefreshSymbols';
import { shouldSuppressSuggestion } from '@/features/market/services/marketSuggestionPolicy';
import type { AthPeriod, InvestmentRecommendation, InvestmentSettings, MarketSnapshot } from '@/features/market/types';
import { toast } from 'sonner';
import { usePortfolioTracker } from '@/features/market/hooks/usePortfolioTracker';
import {
  buildJournalMarketContext,
  canValidateLocalBuyOrder,
  computeBuyQuantity,
  mapDecisionTypeToRecommendationKind,
  pickDefaultPortfolioAccount,
  resolveUnitPriceForValidation,
} from '@/features/market/services/marketValidateOrderFlow';
import { MarketOrderValidationError } from '@/features/market/services/marketValidationErrors';

interface UpdateSettingsInput extends Partial<InvestmentSettings> {}
export const MARKET_PRESET_TTL_HOURS = 12;
const sharedMarketRefreshInFlight = new Map<string, Promise<void>>();

type MarketTTLSource = 'market' | 'dashboard';

interface UseMarketInvestmentOptions {
  source?: MarketTTLSource;
}

function isCachedAthPeriod(value: string): value is AthPeriod {
  return (MARKET_CACHE_ATH_PERIODS as readonly string[]).includes(value);
}

export interface MarketRadarEntry {
  label: string;
  symbol: string;
  snapshot: MarketSnapshot | null;
  recommendation: InvestmentRecommendation | null;
  isActive: boolean;
}

export function useMarketInvestment(organizationId?: string, options?: UseMarketInvestmentOptions) {
  const ttlSource: MarketTTLSource = options?.source ?? 'market';
  const fallbackErrorMessage = 'Données marché indisponibles — saisie manuelle possible';
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
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);
  const [refreshStartedAt, setRefreshStartedAt] = useState<string | null>(null);
  const [refreshCompletedAt, setRefreshCompletedAt] = useState<string | null>(null);
  const [lastSuccessfulRefreshAt, setLastSuccessfulRefreshAt] = useState<string | null>(null);
  const [lastRefreshStatus, setLastRefreshStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [suppressedSuggestion, setSuppressedSuggestion] = useState(false);
  const [manualAnalysisAt, setManualAnalysisAt] = useState<number | null>(null);
  const [radarSnapshots, setRadarSnapshots] = useState<Record<string, MarketSnapshot>>({});
  const [isRefreshingRadar, setIsRefreshingRadar] = useState(false);
  const [radarRefreshNote, setRadarRefreshNote] = useState<string | null>(null);
  const [radarRefreshMode, setRadarRefreshMode] = useState<'idle' | 'manual-forced' | 'auto' | 'skipped-fresh' | 'error'>('idle');
  const [radarLastRefreshedAt, setRadarLastRefreshedAt] = useState<string | null>(null);
  const [lastMarketRefreshScope, setLastMarketRefreshScope] = useState<MarketLastRefreshScope | null>(null);
  const hasTriedAutoRefreshRef = useRef(false);
  const activeRadarToastIdRef = useRef<string | null>(null);
  const radarRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const previousRadarOpportunityKeyRef = useRef<string>('');

  useEffect(() => {
    hasTriedAutoRefreshRef.current = false;
  }, [organizationId]);

  const logHistoryDebug = useCallback(
    (context: string, input: { symbol: string; activeEtf: string; snapshot: MarketSnapshot | null; historyLength: number }) => {
      if (process.env.NODE_ENV !== 'development') return;
      console.info('[MarketHistoryDebug]', {
        context,
        symbol: input.symbol,
        activeEtf: input.activeEtf,
        snapshotFound: Boolean(input.snapshot),
        historyLength: input.historyLength,
        fetchedAt: input.snapshot?.fetchedAt ?? null,
        source: input.snapshot?.source ?? null,
      });
    },
    []
  );

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    const loadedSettings = await marketInvestmentStorage.getSettings(organizationId);
    const radarSymbols = ETF_REFERENCE_ALIASES.map((item) => item.defaultProviderSymbol);
    const keepSet = buildMarketSnapshotKeepSet(loadedSettings, organizationId, radarSymbols);
    const allRows = await marketInvestmentStorage.listAllSnapshots(organizationId);
    const loadedHistory = await marketInvestmentStorage.listActionLogs(organizationId, 24);

    const radarMap: Record<string, MarketSnapshot> = {};
    for (const row of allRows) {
      if (!isCachedAthPeriod(row.athPeriod)) continue;
      const rowNorm = normalizeMarketStorageSymbol(row.symbol);
      if (!keepSet.has(rowNorm)) continue;
      radarMap[marketSnapshotCacheKey(row.symbol, row.athPeriod)] = row;
    }

    const activeCanon = normalizeMarketStorageSymbol(loadedSettings.referenceSymbol);
    const activeKey = marketSnapshotCacheKey(activeCanon, loadedSettings.athPeriod);
    let activeLocalSnapshot = radarMap[activeKey] ?? null;
    if (!activeLocalSnapshot) {
      const fromDb = await marketInvestmentStorage.getSnapshot(organizationId, activeCanon, loadedSettings.athPeriod);
      if (fromDb) {
        activeLocalSnapshot = fromDb;
        radarMap[activeKey] = fromDb;
      }
    }

    setSettings(loadedSettings);
    setRadarSnapshots(radarMap);
    setSnapshot(activeLocalSnapshot);
    const localHistory = marketInvestmentStorage.getPriceHistory(
      organizationId,
      activeCanon,
      loadedSettings.athPeriod
    );
    setPriceHistory(localHistory);
    logHistoryDebug('load', {
      symbol: loadedSettings.referenceSymbol,
      activeEtf: loadedSettings.referenceSymbol,
      snapshot: activeLocalSnapshot,
      historyLength: localHistory.length,
    });
    const latestFetched = Object.values(radarMap)
      .map((row) => row.fetchedAt)
      .filter(Boolean)
      .sort()
      .at(-1);
    setRadarLastRefreshedAt(latestFetched ?? null);
    setHistory(loadedHistory);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const onMarket = (ev: Event) => {
      const d = (ev as CustomEvent<{ organizationId?: string }>).detail;
      if (d?.organizationId && d.organizationId !== organizationId) return;
      void load();
    };
    if (typeof window === 'undefined') return;
    window.addEventListener('market:refresh', onMarket);
    return () => window.removeEventListener('market:refresh', onMarket);
  }, [load, organizationId]);

  const portfolio = usePortfolioTracker(organizationId, settings);

  const recommendation = useMemo(() => {
    if (!settings || !snapshot) return null;
    return computeRecommendation(settings, snapshot, history, { portfolio: portfolio.principalOverlay });
  }, [settings, snapshot, history, portfolio.principalOverlay]);

  const refreshRadar = useCallback(
    async (options?: {
      force?: boolean;
      reason?: 'auto' | 'manual' | 'page-load';
      source?: MarketTTLSource;
      symbolScope?: 'standard' | 'full_library';
    }) => {
      if (!organizationId || !settings) return;
      const force = options?.force ?? false;
      const symbolScope = options?.symbolScope ?? 'standard';
      const ttlMs = MARKET_PRESET_TTL_HOURS * 60 * 60 * 1000;
      const radarSymbols = ETF_REFERENCE_ALIASES.map((item) => item.defaultProviderSymbol);
      const recentEntries = readRecentPrincipalSymbols(organizationId);
      const recentSymbols = recentEntries.map((e) => e.symbol);
      const comparedSymbols = readMarketCompareSymbols(organizationId);
      const standardSymbols = buildMarketRefreshSymbols(settings, radarSymbols, comparedSymbols, recentSymbols);
      const symbolsToRefresh =
        symbolScope === 'full_library'
          ? mergeUniqueMarketRefreshSymbols([
              standardSymbols,
              buildFullTrackableLibrarySymbols({ excludeCrypto: true }),
            ])
          : standardSymbols;
      const periods = MARKET_CACHE_ATH_PERIODS as readonly AthPeriod[];
      const refreshScopeKey = `${organizationId}:${symbolScope}:${symbolsToRefresh.join('|')}:${periods.join('|')}`;
      const logSource = options?.source ?? ttlSource;

      const ttlCheck = await (async () => {
        if (symbolsToRefresh.length === 0) {
          return {
            stale: true,
            freshestTimestamp: null as string | null,
            ageHours: null as number | null,
            hasExpiredSnapshot: false,
            missingCount: periods.length,
          };
        }
        let freshestTimestamp: string | null = null;
        let hasExpiredSnapshot = false;
        let missingCount = 0;
        for (const sym of symbolsToRefresh) {
          for (const athPeriod of periods) {
            const snap = await marketInvestmentStorage.getSnapshot(organizationId, sym, athPeriod);
            if (!snap) {
              missingCount += 1;
              continue;
            }
            const fetchedTs = new Date(snap.fetchedAt).getTime();
            if (!Number.isFinite(fetchedTs)) {
              missingCount += 1;
              continue;
            }
            if (!freshestTimestamp || fetchedTs > new Date(freshestTimestamp).getTime()) {
              freshestTimestamp = snap.fetchedAt;
            }
            if (Date.now() - fetchedTs > ttlMs) {
              hasExpiredSnapshot = true;
            }
          }
        }
        const ageHours = freshestTimestamp ? (Date.now() - new Date(freshestTimestamp).getTime()) / (60 * 60 * 1000) : null;
        const freshestIsFresh = ageHours != null && ageHours <= MARKET_PRESET_TTL_HOURS;
        const stale = hasExpiredSnapshot || (!freshestIsFresh && missingCount > 0) || freshestTimestamp == null;
        return {
          stale,
          freshestTimestamp,
          ageHours,
          hasExpiredSnapshot,
          missingCount,
        };
      })();

      if (process.env.NODE_ENV === 'development' && options?.reason === 'page-load') {
        console.info(`[MarketTTL] source=${logSource}`);
        console.info(`[MarketTTL] lastFetchedAt=${ttlCheck.freshestTimestamp ?? 'none'}`);
        console.info(
          `[MarketTTL] ageHours=${ttlCheck.ageHours == null ? 'n/a' : ttlCheck.ageHours.toFixed(2)}`
        );
        console.info(`[MarketTTL] stale=${ttlCheck.stale}`);
        console.info(`[MarketTTL] missingCount=${ttlCheck.missingCount}`);
      }

      if (!force && !ttlCheck.stale) {
        const nextAutoRefreshInMs = ttlCheck.freshestTimestamp
          ? Math.max(0, ttlMs - (Date.now() - new Date(ttlCheck.freshestTimestamp).getTime()))
          : ttlMs;
        const nextAutoRefreshInHours = Math.max(1, Math.ceil(nextAutoRefreshInMs / (60 * 60 * 1000)));
        setRadarRefreshMode('skipped-fresh');
        setRadarRefreshNote(`Données à jour — prochaine actualisation automatique dans ${nextAutoRefreshInHours} h`);
        if (process.env.NODE_ENV === 'development' && options?.reason === 'page-load') {
          console.info('[MarketTTL] action=skip-auto-refresh');
        }
        return;
      }
      if (process.env.NODE_ENV === 'development' && options?.reason === 'page-load') {
        console.info('[MarketTTL] action=auto-refresh');
      }

      const sharedInFlight = sharedMarketRefreshInFlight.get(refreshScopeKey);
      if (sharedInFlight) {
        await sharedInFlight;
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
          const now = new Date().toISOString();
          const patch: Record<string, MarketSnapshot> = {};
          const totalLots = symbolsToRefresh.length * periods.length;
          let done = 0;

          for (const sym of symbolsToRefresh) {
            const canonSym = normalizeMarketStorageSymbol(sym);
            for (const athPeriod of periods) {
              done += 1;
              setRadarRefreshNote(`Actualisation ${done}/${totalLots}…`);
              const bundle = await marketDataService.fetchYahooMarketBundle({ symbol: canonSym, athPeriod });
              if (!bundle) continue;

              const snapshotRow: MarketSnapshot = {
                id: `${organizationId}:${canonSym}:${athPeriod}`,
                organizationId,
                symbol: canonSym,
                athPeriod,
                currentPrice: bundle.currentPrice,
                athPrice: bundle.athPrice,
                drawdownPercent: bundle.drawdownPercent,
                athDate: bundle.athDate,
                fetchedAt: now,
                source: 'yahoo-api',
              };
              await marketInvestmentStorage.saveSnapshot(snapshotRow);
              patch[marketSnapshotCacheKey(canonSym, athPeriod)] = snapshotRow;
              marketInvestmentStorage.savePriceHistory(organizationId, canonSym, athPeriod, bundle.history);
              if (process.env.NODE_ENV === 'development') {
                console.info('[MarketRefreshGroup]', {
                  symbol: canonSym,
                  athPeriod,
                  historyLength: bundle.history.length,
                });
              }
            }
          }

          const activeCanon = normalizeMarketStorageSymbol(settings.referenceSymbol);
          const activeKey = marketSnapshotCacheKey(activeCanon, settings.athPeriod);
          const activeLocalSnapshot = await marketInvestmentStorage.getSnapshot(
            organizationId,
            activeCanon,
            settings.athPeriod
          );
          setRadarSnapshots((prev) => {
            const merged = { ...prev, ...patch };
            if (activeLocalSnapshot) {
              merged[activeKey] = activeLocalSnapshot;
            }
            return merged;
          });
          setRadarLastRefreshedAt(now);
          setLastMarketRefreshScope(
            symbolScope === 'full_library'
              ? 'full_library'
              : comparedSymbols.length > 0
                ? 'principal_radar_comparaisons'
                : 'principal_radar'
          );
          setSnapshot(activeLocalSnapshot);
          if (activeLocalSnapshot) {
            setMarketError(null);
          }
          const activeHistory = marketInvestmentStorage.getPriceHistory(
            organizationId,
            activeCanon,
            settings.athPeriod
          );
          setPriceHistory(activeHistory);
          logHistoryDebug('refreshRadar', {
            symbol: activeCanon,
            activeEtf: activeCanon,
            snapshot: activeLocalSnapshot,
            historyLength: activeHistory.length,
          });
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
      sharedMarketRefreshInFlight.set(refreshScopeKey, run);
      try {
        await run;
      } finally {
        sharedMarketRefreshInFlight.delete(refreshScopeKey);
        radarRefreshInFlightRef.current = null;
      }
    },
    [organizationId, settings, ttlSource]
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
    // Périmètre « économique » uniquement : pas de scan catalogue complet tant que le TTL global le permet.
    refreshRadar({ force: false, reason: 'page-load', source: ttlSource, symbolScope: 'standard' })
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
  }, [organizationId, refreshRadar, settings, ttlSource]);

  useEffect(() => {
    if (!settings || !organizationId) return undefined;
    let cancelled = false;
    const sym = normalizeMarketStorageSymbol(settings.referenceSymbol);
    const ath = settings.athPeriod;
    const activeKey = marketSnapshotCacheKey(sym, ath);

    (async () => {
      const activeLocalSnapshot = await marketInvestmentStorage.getSnapshot(organizationId, sym, ath);
      if (cancelled) return;
      if (activeLocalSnapshot) {
        setRadarSnapshots((m) => (m[activeKey] ? m : { ...m, [activeKey]: activeLocalSnapshot }));
      }
      const localHistory = marketInvestmentStorage.getPriceHistory(organizationId, sym, ath);
      setSnapshot(activeLocalSnapshot);
      setPriceHistory(localHistory);
      logHistoryDebug('activeSymbolAthHydrate', {
        symbol: sym,
        activeEtf: sym,
        snapshot: activeLocalSnapshot,
        historyLength: localHistory.length,
      });
      if (!activeLocalSnapshot) {
        setMarketError('Données locales absentes pour cet actif. Actualisation nécessaire.');
      } else if (localHistory.length === 0) {
        setMarketError('Historique prix local absent pour cette période. Actualisation nécessaire.');
      } else {
        setMarketError(null);
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [logHistoryDebug, organizationId, settings?.athPeriod, settings?.referenceSymbol]);

  const saveManualSnapshot = useCallback(
    async (input: { currentPrice: number; athPrice: number; athDate?: string }) => {
      if (!organizationId || !settings) return;
      const manual = marketDataService.createManualSnapshot({
        organizationId,
        symbol: normalizeMarketStorageSymbol(settings.referenceSymbol),
        athPeriod: settings.athPeriod,
        currentPrice: input.currentPrice,
        athPrice: input.athPrice,
        athDate: input.athDate,
        source: 'manual',
      });
      manual.id = `${organizationId}:${normalizeMarketStorageSymbol(manual.symbol)}:${settings.athPeriod}`;
      await marketInvestmentStorage.saveSnapshot(manual);
      setSnapshot(manual);
      setMarketError(null);
      setPriceHistory([]);
      marketInvestmentStorage.savePriceHistory(organizationId, manual.symbol, settings.athPeriod, []);
      const manualKey = marketSnapshotCacheKey(normalizeMarketStorageSymbol(manual.symbol), settings.athPeriod);
      setRadarSnapshots((m) => ({ ...m, [manualKey]: manual }));

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

  const updateSettings = useCallback(async (patch: UpdateSettingsInput) => {
    if (!settings) return;
    const merged = { ...settings, ...patch, updatedAt: new Date().toISOString() };
    merged.referenceSymbol = normalizeMarketStorageSymbol(merged.referenceSymbol);
    await marketInvestmentStorage.saveSettings(merged);
    setSettings(merged);
    // Snapshot / historique / erreur : effet `activeSymbolAthHydrate` (symbol + athPeriod globaux).
  }, [settings]);

  const validateDecision = useCallback(
    async (
      validatedAmount: number,
      reason?: string,
      note?: string,
      options?: {
        voluntaryAdditionalInvestment?: boolean;
        accountId?: string | null;
        unitPriceOverride?: number | null;
      }
    ) => {
      if (!organizationId || !settings || !snapshot || !recommendation) return;
      const voluntary = Boolean(options?.voluntaryAdditionalInvestment);
      const cashBefore = settings.availableCash;
      const amount = Math.max(0, Math.min(validatedAmount, cashBefore));
      const resolvedAccountId =
        (options?.accountId && options.accountId.trim() !== ''
          ? options.accountId
          : pickDefaultPortfolioAccount(portfolio.accounts, settings.envelope)) ?? null;
      const unitPrice = resolveUnitPriceForValidation(snapshot, options?.unitPriceOverride ?? undefined);
      const gate = canValidateLocalBuyOrder({
        amountEuro: amount,
        unitPrice,
        accountId: resolvedAccountId,
      });
      if (!gate.ok) {
        const messages: Record<typeof gate.reason, string> = {
          missing_price:
            'Prix indisponible — actualisez les données marché ou saisissez un prix manuellement.',
          zero_amount: 'Montant invalide ou nul.',
          no_account: 'Aucun compte portefeuille — créez un compte dans l’onglet Portefeuille réel.',
          invalid_amount: 'Montant invalide.',
        };
        throw new MarketOrderValidationError(gate.reason, messages[gate.reason]);
      }

      const price = unitPrice as number;
      const cashAfter = cashBefore - amount;
      const thresholdKey = recommendation.thresholdKey;
      const resolvedReason = (reason?.trim() || recommendation.reason).slice(0, 220);

      const resolvedType = voluntary
        ? 'MANUAL'
        : amount !== recommendation.suggestedAmount
          ? 'MANUAL'
          : recommendation.decisionType === 'DCA_ONLY'
            ? 'DCA'
            : recommendation.actionType;

      const recommendationKind = voluntary
        ? ('NONE' as const)
        : mapDecisionTypeToRecommendationKind(recommendation.decisionType);

      const mc = buildJournalMarketContext(snapshot, settings);
      const sym = normalizeMarketStorageSymbol(snapshot.symbol);
      const qty = computeBuyQuantity(amount, price);
      const orderId = crypto.randomUUID();
      const now = new Date().toISOString();
      const nextSettings = { ...settings, availableCash: cashAfter, updatedAt: now };

      await marketInvestmentStorage.saveSettings(nextSettings);
      try {
        await portfolio.saveOrder({
          id: orderId,
          organizationId,
          accountId: resolvedAccountId as string,
          assetSymbol: sym,
          type: 'BUY',
          date: now,
          quantity: qty,
          unitPrice: price,
          grossAmount: amount,
          fees: 0,
          taxes: 0,
          currency: settings.currency,
          note: note?.trim() ? note.trim() : null,
          createdAt: now,
          updatedAt: now,
        });
      } catch (err) {
        await marketInvestmentStorage.saveSettings({ ...settings, updatedAt: new Date().toISOString() });
        throw err;
      }

      await marketInvestmentStorage.addActionLog(
        marketInvestmentStorage.buildActionLog({
          organizationId,
          type: resolvedType,
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
          portfolioOrderId: orderId,
          portfolioAccountId: resolvedAccountId,
          validatedQuantity: qty,
          validatedUnitPrice: price,
          recommendationKind,
          journalSource: voluntary ? 'user' : 'assistant',
          journalEntryType: voluntary ? 'MANUAL_DECISION' : 'RECOMMENDATION',
          marketContextSnapshot: mc,
          validatedAt: now,
        })
      );

      setSettings(nextSettings);
      setHistory(await marketInvestmentStorage.listActionLogs(organizationId, 24));
      await portfolio.reload();
    },
    [organizationId, portfolio, recommendation, settings, snapshot]
  );

  const ignoreDecision = useCallback(async () => {
    if (!organizationId || !settings || !snapshot || !recommendation) return;
    const ignoredAt = new Date().toISOString();
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
        ignoredAt,
      })
    );
    setHistory(await marketInvestmentStorage.listActionLogs(organizationId, 24));
  }, [organizationId, recommendation, settings, snapshot]);

  const restoreIgnoredDecision = useCallback(
    async (logId: string): Promise<'ok' | 'not_found' | 'invalid_status' | 'failed'> => {
      if (!organizationId) return 'not_found';
      const outcome = await marketInvestmentStorage.deleteIgnoredDecision(organizationId, logId);
      if (outcome === 'ok') {
        setHistory(await marketInvestmentStorage.listActionLogs(organizationId, 24));
      }
      return outcome;
    },
    [organizationId]
  );

  useEffect(() => {
    if (!organizationId || !settings || !recommendation?.thresholdKey) {
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
            policySettings: settings,
          })
        );
      })
      .catch(() => setSuppressedSuggestion(false));
  }, [manualAnalysisAt, organizationId, recommendation, recommendation?.thresholdKey, settings, snapshot?.drawdownPercent]);

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
      await refreshRadar({ force: true, reason: 'manual', symbolScope: 'full_library' });
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
      const rowKey = marketSnapshotCacheKey(alias.defaultProviderSymbol, settings.athPeriod);
      const row = radarSnapshots[rowKey] ?? null;
      const recommendationForRow = row ? computeRecommendation(settings, row, history) : null;
      const isActive =
        normalizeMarketStorageSymbol(settings.referenceSymbol) ===
        normalizeMarketStorageSymbol(alias.defaultProviderSymbol);
      return {
        label: alias.label,
        symbol: alias.defaultProviderSymbol,
        snapshot: row,
        recommendation: recommendationForRow,
        isActive,
      };
    });
  }, [history, radarSnapshots, settings]);

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

  const updateHistoryDecision = useCallback(
    async (
      logId: string,
      patch: { validatedAmount: number; reason: string; note?: string | null }
    ): Promise<'ok' | 'not_found' | 'invalid_status' | 'invalid_amount'> => {
      if (!organizationId) return 'not_found';
      const outcome = await marketInvestmentStorage.updateValidatedDecision(organizationId, logId, patch);
      if (outcome === 'ok') {
        setSettings(await marketInvestmentStorage.getSettings(organizationId));
        setHistory(await marketInvestmentStorage.listActionLogs(organizationId, 24));
      }
      return outcome;
    },
    [organizationId]
  );

  const deleteHistoryDecision = useCallback(
    async (logId: string): Promise<'ok' | 'not_found' | 'invalid_status' | 'failed'> => {
      if (!organizationId) return 'not_found';
      const outcome = await marketInvestmentStorage.deleteValidatedDecision(organizationId, logId);
      if (outcome === 'ok') {
        setSettings(await marketInvestmentStorage.getSettings(organizationId));
        setHistory(await marketInvestmentStorage.listActionLogs(organizationId, 24));
      }
      return outcome;
    },
    [organizationId]
  );

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
    isRefreshingRadar,
    radarRefreshNote,
    radarRefreshMode,
    radarLastRefreshedAt,
    lastMarketRefreshScope,
    recommendation,
    radarEntries,
    priceHistory,
    isHistoryLoading,
    suppressedSuggestion,
    refreshSnapshot: refreshAllMarketData,
    refreshAllMarketData,
    refreshRadar,
    saveManualSnapshot,
    updateSettings,
    validateDecision,
    ignoreDecision,
    restoreIgnoredDecision,
    requestManualAnalysis,
    updateHistoryDecision,
    deleteHistoryDecision,
    reload: load,
    portfolio,
  };
}

export type MarketInvestmentController = ReturnType<typeof useMarketInvestment>;
