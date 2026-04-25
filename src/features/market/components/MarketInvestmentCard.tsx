'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { generateDecisionMessage } from '@/features/market/services/marketDecisionV2';
import { DEFAULT_REINFORCE_LEVELS } from '@/features/market/services/marketInvestmentStrategy';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { ArrowLeft, ChartNoAxesCombined, Info, Lightbulb, Loader2, Sparkles, WalletCards } from 'lucide-react';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useMarketInvestment } from '@/features/market/hooks/useMarketInvestment';
import {
  CUSTOM_MARKET_SYMBOL_KEY,
  ETF_REFERENCE_ALIASES,
  findEtfAliasFromSettings,
  resolveMarketSymbol,
} from '@/features/market/marketSymbolAliases';
import { MarketPriceChart } from '@/features/market/components/MarketPriceChart';
import { MarketRadarPanel } from '@/features/market/components/MarketRadarPanel';
import { MarketStrategySimulationCard } from '@/features/market/components/MarketStrategySimulationCard';
import type { InvestmentSettings, MarketOpportunityStatus, MarketScoreLabel } from '@/features/market/types';

function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDrawdownPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function statusBadge(status: MarketOpportunityStatus): { label: string; variant: 'success' | 'warning' | 'danger' } {
  if (status === 'FORTE_OPPORTUNITE') return { label: 'FORTE OPPORTUNITE', variant: 'danger' };
  if (status === 'OPPORTUNITE') return { label: 'OPPORTUNITE', variant: 'warning' };
  return { label: 'NORMAL', variant: 'success' };
}

function marketScoreBadge(label: MarketScoreLabel): { variant: 'success' | 'warning' | 'danger' | 'secondary' } {
  if (label === 'MARCHÉ HAUT') return { variant: 'warning' };
  if (label === 'MARCHÉ NEUTRE') return { variant: 'secondary' };
  return { variant: 'success' };
}

const ATH_TOOLTIP = 'Plus haut historique sur la période sélectionnée';

/** Indication pédagogique selon le niveau de drawdown (seuils indicatifs, sans calcul métier). */
function drawdownActionHint(drawdownPercent: number): string {
  if (drawdownPercent > -5) return 'Marché proche de son plus haut';
  if (drawdownPercent > -10) return 'Approche d’une zone d’intérêt';
  if (drawdownPercent > -20) return 'Zone d’intérêt';
  if (drawdownPercent > -30) return 'Bonne opportunité';
  if (drawdownPercent > -40) return 'Forte opportunité';
  return 'Zone exceptionnelle';
}

function stripImportantLeadIn(raw: string): string {
  return raw.replace(/^Important\s*:\s*\n?/i, '').trim();
}

/** Barre drawdown avec zones : vert (0 à -10), orange (-10 à -20), rouge (-20 à -30), violet (-30 à -40) */
function DrawdownBar({ drawdownPercent }: { drawdownPercent: number }) {
  const clamped = Math.max(-40, Math.min(0, drawdownPercent));
  const markerLeftPct = ((clamped + 40) / 40) * 100;
  const zoneClass = ['bg-emerald-500', 'bg-orange-400', 'bg-red-500', 'bg-violet-600'] as const;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-[11px] leading-tight text-slate-500">
        <span className="max-w-[48%] text-left">Forte opportunité (-40%)</span>
        <span className="max-w-[48%] text-right" title={ATH_TOOLTIP}>
          ATH (0%)
        </span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-slate-200/80">
        {zoneClass.map((cls, i) => (
          <div key={i} className={`${cls} min-w-0 flex-1`} />
        ))}
      </div>
      <div className="relative h-4 text-xs text-slate-500">
        <span>-40%</span>
        <span className="absolute left-[25%] top-0 -translate-x-1/2">-30%</span>
        <span className="absolute left-[50%] top-0 -translate-x-1/2">-20%</span>
        <span className="absolute left-[75%] top-0 -translate-x-1/2">-10%</span>
        <span className="absolute right-0 top-0">0%</span>
        <div
          className="pointer-events-none absolute top-[-5px] h-4 w-0.5 rounded-full bg-slate-900 shadow-md ring-1 ring-slate-900/20 transition-[left] duration-700 ease-out motion-safe:animate-pulse motion-reduce:animate-none motion-reduce:transition-none"
          style={{ left: `calc(${markerLeftPct}% - 1px)` }}
        />
      </div>
      <p className="text-xs text-slate-600">
        Position actuelle : <span className="font-semibold tabular-nums text-slate-900">{formatDrawdownPercent(drawdownPercent)}</span> sous le plus haut
      </p>
      <p className="text-xs font-medium text-slate-800">{drawdownActionHint(drawdownPercent)}</p>
      <div className="flex items-start gap-2 rounded-lg border border-slate-100 bg-gradient-to-l from-violet-50/80 to-emerald-50/50 px-2 py-1.5">
        <ArrowLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
        <p className="text-[11px] leading-snug text-slate-600">
          Plus le curseur va vers la gauche, plus l’opportunité d’investissement est élevée.
        </p>
      </div>
    </div>
  );
}

function allocForThreshold(settings: InvestmentSettings | null, threshold: number): string {
  if (!settings?.investmentStrategy?.reinforceLevels?.length) {
    return String(DEFAULT_REINFORCE_LEVELS.find((l) => l.threshold === threshold)?.allocationPercent ?? '');
  }
  const v = settings.investmentStrategy.reinforceLevels.find((l) => l.threshold === threshold)?.allocationPercent;
  return String(v ?? '');
}

interface MarketInvestmentCardProps {
  openSettingsSignal?: number;
}

export function MarketInvestmentCard({ openSettingsSignal = 0 }: MarketInvestmentCardProps) {
  const freshnessTtlHours = 12;
  const freshnessTtlMs = freshnessTtlHours * 60 * 60 * 1000;
  const { organizationId } = useCurrentOrganization();
  const {
    settings,
    snapshot,
    history,
    loading,
    marketError,
    recommendation,
    suppressedSuggestion,
    providerConfig,
    lastRefreshAttemptAt,
    lastProviderSymbol,
    priceHistory,
    isHistoryLoading,
    isRefreshingMarket,
    refreshCompletedAt,
    lastSuccessfulRefreshAt,
    lastRefreshStatus,
    isRefreshingRadar,
    radarRefreshNote,
    radarRefreshMode,
    radarLastRefreshedAt,
    radarEntries,
    refreshAllMarketData,
    saveManualSnapshot,
    updateSettings,
    validateDecision,
    ignoreDecision,
    requestManualAnalysis,
  } = useMarketInvestment(organizationId);

  const [editOpen, setEditOpen] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [manualCurrentPrice, setManualCurrentPrice] = useState('');
  const [manualAthPrice, setManualAthPrice] = useState('');
  const [validateAmount, setValidateAmount] = useState('');
  const [validateReason, setValidateReason] = useState('');
  const [, setRefreshAgeTick] = useState(0);
  const forceRefreshResetTimerRef = useRef<number | null>(null);
  const [isForceRefreshArmed, setIsForceRefreshArmed] = useState(false);
  const [softRefreshWarning, setSoftRefreshWarning] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    etfPreset: CUSTOM_MARKET_SYMBOL_KEY,
    referenceSymbol: '',
    referenceLabel: '',
    envelope: 'PEA',
    athPeriod: 'MAX',
    strategy: 'DCA_PLUS_REINFORCE',
    monthlyDcaAmount: '',
    reinforce10Threshold: '',
    reinforce20Threshold: '',
    reinforce10Amount: '',
    reinforce20Amount: '',
    reinforceAlloc10: '',
    reinforceAlloc20: '',
    reinforceAlloc30: '',
    reinforceAlloc40: '',
    availableCash: '',
  });

  const snapshotStatus = useMemo(() => {
    if (!recommendation) return null;
    return statusBadge(recommendation.status);
  }, [recommendation]);

  const decisionMessage = useMemo(() => {
    if (!recommendation || !snapshot || !settings) return null;
    return generateDecisionMessage(recommendation, snapshot, settings);
  }, [recommendation, settings, snapshot]);

  const scoreBadge = useMemo(() => {
    if (!recommendation) return null;
    return marketScoreBadge(recommendation.marketScoreLabel);
  }, [recommendation]);
  const activeEtfAlias = useMemo(
    () => findEtfAliasFromSettings(settings?.referenceLabel ?? '', settings?.referenceSymbol ?? ''),
    [settings?.referenceLabel, settings?.referenceSymbol]
  );
  const resolvedMarketSymbol = useMemo(
    () => resolveMarketSymbol(settings?.referenceSymbol ?? ''),
    [settings?.referenceSymbol]
  );
  const sourceLabel = snapshot?.source === 'manual' ? 'Saisie manuelle' : (snapshot?.source ?? 'Non disponible');
  const refreshSuccessVisible =
    lastRefreshStatus === 'success' &&
    refreshCompletedAt !== null &&
    Date.now() - new Date(refreshCompletedAt).getTime() < 6000;
  const activeEtfOptions = useMemo(() => {
    const base = ETF_REFERENCE_ALIASES.map((alias) => ({
      key: alias.defaultProviderSymbol,
      label: `${alias.label} — ${alias.defaultProviderSymbol}`,
      referenceLabel: alias.label,
      referenceSymbol: alias.defaultProviderSymbol,
    }));
    const currentIsPreset = base.some((item) => item.referenceSymbol === settings?.referenceSymbol);
    if (!settings || currentIsPreset) return base;
    return [
      ...base,
      {
        key: settings.referenceSymbol,
        label: `${settings.referenceLabel || 'Symbole personnalisé'} — ${settings.referenceSymbol}`,
        referenceLabel: settings.referenceLabel || settings.referenceSymbol,
        referenceSymbol: settings.referenceSymbol,
      },
    ];
  }, [settings]);
  const latestKnownMarketUpdateAt = useMemo(() => {
    const candidates = [snapshot?.fetchedAt ?? null, radarLastRefreshedAt ?? null]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value));
    if (candidates.length === 0) return null;
    return new Date(Math.max(...candidates)).toISOString();
  }, [radarLastRefreshedAt, snapshot?.fetchedAt]);
  const oldestKnownMarketUpdateAt = useMemo(() => {
    const candidates = [snapshot?.fetchedAt ?? null, radarLastRefreshedAt ?? null]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value));
    if (candidates.length === 0) return null;
    return new Date(Math.min(...candidates)).toISOString();
  }, [radarLastRefreshedAt, snapshot?.fetchedAt]);
  const hasAnyMarketData = Boolean(snapshot || radarLastRefreshedAt);
  const isMarketDataFresh = useMemo(() => {
    if (!snapshot || !radarLastRefreshedAt) return false;
    const snapshotAge = Date.now() - new Date(snapshot.fetchedAt).getTime();
    const radarAge = Date.now() - new Date(radarLastRefreshedAt).getTime();
    return snapshotAge < freshnessTtlMs && radarAge < freshnessTtlMs;
  }, [freshnessTtlMs, radarLastRefreshedAt, snapshot]);
  const nextAutoRefreshHours = useMemo(() => {
    if (!oldestKnownMarketUpdateAt) return null;
    const remainingMs = freshnessTtlMs - (Date.now() - new Date(oldestKnownMarketUpdateAt).getTime());
    if (remainingMs <= 0) return 0;
    return Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
  }, [freshnessTtlMs, oldestKnownMarketUpdateAt]);
  const isNewAth = useMemo(() => {
    if (!snapshot) return false;
    return Math.abs(snapshot.currentPrice - snapshot.athPrice) <= 0.0001;
  }, [snapshot]);
  const athPeriodLabel = settings?.athPeriod === 'MAX' ? 'MAX' : `${settings?.athPeriod ?? 'MAX'}`;

  useEffect(() => {
    if (openSettingsSignal <= 0 || !settings) return;
    openSettingsModal();
  }, [openSettingsSignal, settings]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setRefreshAgeTick((prev) => prev + 1);
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (forceRefreshResetTimerRef.current !== null) {
        window.clearTimeout(forceRefreshResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isRefreshingMarket || isRefreshingRadar) {
      resetForceRefreshState();
    }
  }, [isRefreshingMarket, isRefreshingRadar]);

  if (!organizationId || loading || !settings) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="py-3.5">
          <p className="text-sm text-slate-500">Chargement du module Marché & Investissement...</p>
        </CardContent>
      </Card>
    );
  }

  const applyManualPrices = async () => {
    const current = Number(manualCurrentPrice);
    const ath = Number(manualAthPrice);
    if (!Number.isFinite(current) || !Number.isFinite(ath) || ath <= 0 || current <= 0) return;
    await saveManualSnapshot({ currentPrice: current, athPrice: ath });
    setManualCurrentPrice('');
    setManualAthPrice('');
  };

  const openValidation = () => {
    if (!recommendation) return;
    setValidateAmount(String(recommendation.suggestedAmount));
    setValidateReason(recommendation.reason);
    setValidateOpen(true);
  };

  const handleActiveEtfChange = async (nextSymbol: string) => {
    if (!settings) return;
    const selected = activeEtfOptions.find((item) => item.referenceSymbol === nextSymbol);
    if (!selected) return;
    if (selected.referenceSymbol === settings.referenceSymbol && selected.referenceLabel === settings.referenceLabel) return;
    await updateSettings({
      referenceSymbol: selected.referenceSymbol,
      referenceLabel: selected.referenceLabel,
    });
  };

  const formatRelativeHours = (dateIso: string | null): string => {
    if (!dateIso) return 'n/a';
    const elapsedMs = Math.max(0, Date.now() - new Date(dateIso).getTime());
    const elapsedHours = Math.max(0, Math.floor(elapsedMs / (60 * 60 * 1000)));
    if (elapsedHours <= 0) return '< 1 h';
    return `${elapsedHours} h`;
  };

  const resetForceRefreshState = () => {
    setIsForceRefreshArmed(false);
    setSoftRefreshWarning(null);
    if (forceRefreshResetTimerRef.current !== null) {
      window.clearTimeout(forceRefreshResetTimerRef.current);
      forceRefreshResetTimerRef.current = null;
    }
  };

  const armForceRefresh = () => {
    setIsForceRefreshArmed(true);
    const relative = formatRelativeHours(latestKnownMarketUpdateAt);
    setSoftRefreshWarning(
      `Données déjà récentes — dernière MAJ il y a ${relative}. Forcer l’actualisation consommera une requête API.`
    );
    if (forceRefreshResetTimerRef.current !== null) {
      window.clearTimeout(forceRefreshResetTimerRef.current);
    }
    forceRefreshResetTimerRef.current = window.setTimeout(() => {
      setIsForceRefreshArmed(false);
      setSoftRefreshWarning(null);
      forceRefreshResetTimerRef.current = null;
    }, 9000);
  };

  const handleRefreshClick = async () => {
    if (isRefreshingMarket || isRefreshingRadar) return;
    if (!hasAnyMarketData || !isMarketDataFresh) {
      resetForceRefreshState();
      await refreshAllMarketData();
      return;
    }
    if (!isForceRefreshArmed) {
      armForceRefresh();
      return;
    }
    resetForceRefreshState();
    await refreshAllMarketData();
  };

  const submitValidation = async () => {
    await validateDecision(Number(validateAmount), validateReason);
    setValidateOpen(false);
  };

  const saveCashUpdate = async () => {
    const cash = Number(settingsForm.availableCash);
    const dca = Number(settingsForm.monthlyDcaAmount);
    const threshold10 = Number(settingsForm.reinforce10Threshold);
    const threshold20 = Number(settingsForm.reinforce20Threshold);
    const r10 = Number(settingsForm.reinforce10Amount);
    const r20 = Number(settingsForm.reinforce20Amount);
    const a10 = Number(settingsForm.reinforceAlloc10);
    const a20 = Number(settingsForm.reinforceAlloc20);
    const a30 = Number(settingsForm.reinforceAlloc30);
    const a40 = Number(settingsForm.reinforceAlloc40);
    if (![cash, dca, r10, r20, a10, a20, a30, a40].every((v) => Number.isFinite(v) && v >= 0)) return;
    if (![a10, a20, a30, a40].every((v) => v <= 100)) return;
    if (![threshold10, threshold20].every((v) => Number.isFinite(v) && v <= 0)) return;
    const selectedAlias =
      settingsForm.etfPreset !== CUSTOM_MARKET_SYMBOL_KEY
        ? ETF_REFERENCE_ALIASES.find((alias) => alias.key === settingsForm.etfPreset) ?? null
        : null;
    const nextSymbol = selectedAlias
      ? selectedAlias.defaultProviderSymbol
      : resolveMarketSymbol(settingsForm.referenceSymbol.trim());
    const nextLabel = selectedAlias ? selectedAlias.label : settingsForm.referenceLabel.trim();

    await updateSettings({
      referenceSymbol: nextSymbol,
      referenceLabel: nextLabel,
      envelope: settingsForm.envelope as InvestmentSettings['envelope'],
      athPeriod: settingsForm.athPeriod as InvestmentSettings['athPeriod'],
      strategy: settingsForm.strategy as InvestmentSettings['strategy'],
      availableCash: cash,
      monthlyDcaAmount: dca,
      reinforce10Threshold: threshold10,
      reinforce20Threshold: threshold20,
      reinforce10Amount: r10,
      reinforce20Amount: r20,
      investmentStrategy: {
        monthlyDca: dca,
        reinforceLevels: [
          { threshold: -10, allocationPercent: a10 },
          { threshold: -20, allocationPercent: a20 },
          { threshold: -30, allocationPercent: a30 },
          { threshold: -40, allocationPercent: a40 },
        ],
      },
    });
    setEditOpen(false);
  };

  const openSettingsModal = () => {
    setSettingsForm({
      etfPreset: findEtfAliasFromSettings(settings.referenceLabel, settings.referenceSymbol)?.key ?? CUSTOM_MARKET_SYMBOL_KEY,
      referenceSymbol: settings.referenceSymbol,
      referenceLabel: settings.referenceLabel,
      envelope: settings.envelope,
      athPeriod: settings.athPeriod,
      strategy: settings.strategy,
      monthlyDcaAmount: String(settings.monthlyDcaAmount),
      reinforce10Threshold: String(settings.reinforce10Threshold),
      reinforce20Threshold: String(settings.reinforce20Threshold),
      reinforce10Amount: String(settings.reinforce10Amount),
      reinforce20Amount: String(settings.reinforce20Amount),
      reinforceAlloc10: allocForThreshold(settings, -10) || '10',
      reinforceAlloc20: allocForThreshold(settings, -20) || '20',
      reinforceAlloc30: allocForThreshold(settings, -30) || '30',
      reinforceAlloc40: allocForThreshold(settings, -40) || '40',
      availableCash: String(settings.availableCash),
    });
    setEditOpen(true);
  };

  return (
    <div className="space-y-3.5">
      <MarketRadarPanel
        entries={radarEntries}
        currency={settings.currency}
        lastUpdatedAt={radarLastRefreshedAt}
        athPeriod={settings.athPeriod}
      />

      <Card className="w-full border-slate-200 bg-white shadow-sm" padding="none">
        <CardContent className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <label htmlFor="market-active-etf" className="shrink-0 text-xs font-medium leading-none text-slate-600">
              ETF actif
            </label>
            <select
              id="market-active-etf"
              className="h-8 min-h-0 w-full min-w-0 max-w-xl rounded-full border border-violet-200 bg-violet-50 px-3 py-0 text-xs font-medium leading-tight text-violet-800 sm:min-w-[280px] sm:flex-1"
              value={settings.referenceSymbol}
              onChange={(e) => handleActiveEtfChange(e.target.value).catch(() => undefined)}
              disabled={isRefreshingMarket}
            >
              {activeEtfOptions.map((option) => (
                <option key={option.key} value={option.referenceSymbol}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {snapshotStatus && <Badge size="sm" variant={snapshotStatus.variant}>{snapshotStatus.label}</Badge>}
            {recommendation && scoreBadge && (
              <Badge size="sm" variant={scoreBadge.variant}>
                {recommendation.marketScoreLabel}
              </Badge>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleRefreshClick().catch(() => undefined)}
              disabled={isRefreshingMarket || isRefreshingRadar}
            >
              {isRefreshingMarket ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                  Actualisation...
                </span>
              ) : isForceRefreshArmed ? (
                'Forcer l’actualisation'
              ) : (
                'Actualiser'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {refreshSuccessVisible && (
        <p className="text-xs text-emerald-700">Données à jour</p>
      )}
      {softRefreshWarning && (
        <p className="text-xs text-amber-700">{softRefreshWarning}</p>
      )}
      {!isRefreshingRadar && !radarRefreshNote && nextAutoRefreshHours !== null && (
        <p className="text-xs text-slate-500">Prochaine MAJ auto dans {nextAutoRefreshHours} h</p>
      )}
      {(isRefreshingRadar || radarRefreshNote) && (
        <p className={`text-xs ${radarRefreshMode === 'error' ? 'text-amber-700' : radarRefreshMode === 'manual-forced' ? 'text-amber-700' : 'text-emerald-700'}`}>
          {isRefreshingRadar ? 'Actualisation des données marché…' : radarRefreshNote}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:items-stretch">
      <Card className="min-w-0 border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3.5 py-4">
        <div className="space-y-1">
          <h3 className="text-[15px] font-semibold leading-6 text-slate-900">Marché & Investissement</h3>
          <p className="text-xs leading-5 text-slate-500">Module décisionnel ETF local-first</p>
        </div>
        <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-2.5">
            <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-violet-700"><WalletCards className="h-3.5 w-3.5" />Synthèse investissement</p>
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <p className="text-xs text-slate-500">ETF suivi</p>
              <Badge size="sm" variant={activeEtfAlias ? 'secondary' : 'gray'}>
                {activeEtfAlias ? 'Preset ETF' : 'Symbole personnalisé'}
              </Badge>
            </div>
            <p className="text-sm font-medium leading-5 text-slate-900">{settings.referenceLabel}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              Support d’investissement sélectionné à titre indicatif. Smartimmo ne recommande pas un ETF en particulier.
            </p>
            <p className="text-xs leading-5 text-slate-500">
              ETF actif : {settings.referenceLabel} ({resolvedMarketSymbol || settings.referenceSymbol})
            </p>
            <p className="text-xs leading-5 text-slate-500">Symbole marché : {resolvedMarketSymbol || settings.referenceSymbol}</p>
            <p className="text-xs leading-5 text-slate-500">Source : {sourceLabel}</p>
            <p className="mt-1.5 text-xs text-slate-500">Cash restant à investir :</p>
            <p className="text-xl font-semibold leading-6 text-emerald-700">{formatCurrency(settings.availableCash, settings.currency)}</p>
            <p className="mt-2 text-xs text-slate-600">
              Projection annuelle DCA :{' '}
              <span className="font-semibold text-slate-800">
                ≈ {formatCurrency(settings.monthlyDcaAmount * 12, settings.currency)} investis / an
              </span>
            </p>
            {recommendation && (
              <div className="mt-2 rounded-lg border border-violet-200/80 bg-white/80 px-2 py-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700">Score marché</p>
                <p className="text-lg font-semibold tabular-nums text-violet-900">
                  {recommendation.score} <span className="text-sm font-medium text-slate-500">/ 100</span>
                </p>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">
                  Plus le score est élevé, plus le marché est proche de ses plus hauts.
                </p>
              </div>
            )}
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-2.5">
            <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-sky-700"><ChartNoAxesCombined className="h-3.5 w-3.5" />Marché</p>
            <p className="text-xs text-slate-500">Prix actuel / Plus haut de référence</p>
            <p className="text-xl font-semibold leading-6 text-slate-900">
              {snapshot ? `${snapshot.currentPrice.toFixed(2)} / ${snapshot.athPrice.toFixed(2)}` : 'Non renseigné'}
            </p>
            {isNewAth && (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5">
                <p className="text-xs font-semibold text-emerald-700">NOUVEAU ATH</p>
                <p className="text-xs text-emerald-700">Le marché est sur son plus haut.</p>
              </div>
            )}
            <div className="mt-2">
              <Badge size="sm" variant="secondary" title={ATH_TOOLTIP}>
                ATH calculé sur : {athPeriodLabel}
              </Badge>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Dernière actualisation</p>
            <p className="text-xs leading-5 text-slate-900">{snapshot ? new Date(snapshot.fetchedAt).toLocaleString('fr-FR') : 'Aucune'}</p>
            {snapshot?.source && (
              <p className="text-xs leading-5 text-slate-500">Source : {snapshot.source === 'manual' ? 'Saisie manuelle' : snapshot.source}</p>
            )}
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-2.5">
              <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-indigo-700"><Info className="h-3.5 w-3.5" />Données marché automatiques</p>
              <div className="grid grid-cols-1 gap-3 text-xs leading-5 text-slate-600 md:grid-cols-2">
                <div className="space-y-0.5">
                  <p>Source utilisée : <span className="font-medium text-slate-800">{snapshot?.source === 'yahoo-api' ? 'Yahoo Finance' : sourceLabel}</span></p>
                  <p>Symbole utilisé : <span className="font-medium text-slate-800">{lastProviderSymbol ?? resolvedMarketSymbol ?? '-'}</span></p>
                  <p>Dernière MAJ : {latestKnownMarketUpdateAt ? new Date(latestKnownMarketUpdateAt).toLocaleString('fr-FR') : 'Aucune'}</p>
                </div>
                <div className="space-y-0.5">
                  <p>Dernier succès : {lastSuccessfulRefreshAt ? new Date(lastSuccessfulRefreshAt).toLocaleString('fr-FR') : 'Aucun'}</p>
                  <p>Dernière tentative : {lastRefreshAttemptAt ? new Date(lastRefreshAttemptAt).toLocaleString('fr-FR') : 'Aucune'}</p>
                  <p>Prochaine actualisation : {nextAutoRefreshHours !== null ? `dans ${nextAutoRefreshHours} h` : 'n/a'}</p>
                </div>
              </div>
              {snapshot?.source === 'yahoo-api' && !marketError && (
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Données récupérées automatiquement via Yahoo Finance (source non officielle).
                </p>
              )}
              {marketError && (
                <p className="mt-1 text-xs leading-5 text-amber-700">
                  {marketError}
                </p>
              )}
              {providerConfig.status === 'missing_api_key' && (
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  Ajoutez <code>NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY</code> dans votre fichier <code>.env.local</code> pour activer l'actualisation automatique.
                </p>
              )}
              {providerConfig.status === 'disabled' && (
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  L'actualisation automatique est désactivée via <code>NEXT_PUBLIC_MARKET_PROVIDER_ENABLED=false</code>.
                </p>
              )}
              <p className="mt-1 text-xs leading-5 text-slate-500">
                La saisie manuelle reste disponible et fonctionne en permanence.
              </p>
            </div>

            {snapshot && (
              <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Drawdown</p>
                <p className="mb-1.5 text-xs leading-5 text-slate-500">Écart actuel sous le plus haut de référence</p>
                <DrawdownBar drawdownPercent={snapshot.drawdownPercent} />
              </div>
            )}

            {!snapshot && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2.5">
                <p className="text-sm leading-5 text-slate-700">
                  Données indisponibles localement — cliquez sur Actualiser.
                </p>
              </div>
            )}
        </div>
        {marketError && <p className="text-sm text-amber-700">{marketError}</p>}

        <div className="grid grid-cols-1 gap-2.5">
          <div className="rounded-xl border border-slate-200 p-2.5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Saisie marché</p>
            <p className="mb-2 text-sm font-medium text-slate-900">Saisie manuelle marché</p>
            <div className="space-y-1.5">
              <Input type="number" placeholder="Prix actuel" value={manualCurrentPrice} onChange={(e) => setManualCurrentPrice(e.target.value)} />
              <Input type="number" placeholder="Plus haut de référence" value={manualAthPrice} onChange={(e) => setManualAthPrice(e.target.value)} />
              <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={applyManualPrices}>Enregistrer les prix</Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-2.5">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5 text-xs">
            <span className="text-slate-600">Cash restant à investir : {formatCurrency(settings.availableCash, settings.currency)}</span>
          </div>
          {(() => {
            const reference = settings.cashReferenceAmount > 0 ? settings.cashReferenceAmount : Math.max(settings.availableCash, 1);
            const allocated = Math.max(0, reference - settings.availableCash);
            const allocatedPct = Math.min(100, Math.max(0, (allocated / reference) * 100));
            return (
              <>
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-3 rounded-full bg-orange-500 transition-all" style={{ width: `${allocatedPct}%` }} />
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{allocatedPct.toFixed(1)}% déjà alloué</p>
              </>
            );
          })()}
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Historique</p>
          <p className="mb-2 text-sm font-medium text-slate-900">Mes décisions récentes</p>
          <div className="space-y-1.5">
            {history.length === 0 && (
              <p className="text-sm leading-relaxed text-slate-500">
                Aucune décision enregistrée.
                <br />
                Les actions validées apparaîtront ici.
              </p>
            )}
            {history.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium leading-5 text-slate-900">{new Date(item.date).toLocaleDateString('fr-FR')}</span>
                  <span className="text-sm leading-5 text-slate-700">{formatCurrency(item.validatedAmount, settings.currency)}</span>
                </div>
                <p className="text-xs font-medium text-slate-700">
                  Niveau marché (drawdown) :{' '}
                  {item.drawdownAtDecision != null ? `${item.drawdownAtDecision.toFixed(1)} %` : '—'}
                </p>
                <p className="text-xs leading-5 text-slate-500">
                  {item.type === 'DCA' ? 'DCA' : item.type === 'MANUAL' ? 'Montant manuel' : 'Renfort'} • {item.status} • {item.symbolAtDecision}
                </p>
                <p className="text-xs leading-5 text-slate-500">
                  Drawdown {item.drawdownAtDecision != null ? item.drawdownAtDecision.toFixed(2) : '-'}% • ATH {item.athPriceAtDecision?.toFixed(2) ?? '-'} • Prix {item.currentPriceAtDecision?.toFixed(2) ?? '-'}
                </p>
                <p className="text-xs leading-5 text-slate-500">
                  Cash {formatCurrency(item.cashBefore, settings.currency)} → {formatCurrency(item.cashAfter, settings.currency)} • Période {item.athPeriodAtDecision}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      </Card>

      <div className="min-w-0 space-y-3">
        <Card className="flex h-full min-w-0 flex-col border-slate-200 bg-white shadow-sm">
          <CardContent className="flex flex-1 flex-col space-y-3 py-4">
            <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-violet-700">
              <ChartNoAxesCombined className="h-3.5 w-3.5 shrink-0" />
              Évolution prix
            </p>
            {snapshot ? (
              <MarketPriceChart
                series={priceHistory}
                athPrice={snapshot?.athPrice ?? 1}
                currentPrice={snapshot?.currentPrice ?? 1}
                reinforce10Threshold={settings.reinforce10Threshold}
                reinforce20Threshold={settings.reinforce20Threshold}
                isRefreshing={isRefreshingMarket}
                etfLabel={settings.referenceLabel}
                etfSymbol={resolvedMarketSymbol || settings.referenceSymbol}
              />
            ) : (
              <div className="h-[260px] animate-pulse rounded-lg bg-slate-100" />
            )}
            {snapshot && !isRefreshingMarket && !isHistoryLoading && priceHistory.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
                <p className="text-xs text-slate-600">Historique indisponible — cliquez sur Actualiser</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5">
                <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-emerald-700"><Sparkles className="h-3.5 w-3.5" />Nouveau ATH !</p>
                <p className="mt-1 text-xs text-emerald-700">
                  {isNewAth ? 'Le prix actuel est au plus haut de la période.' : 'Le marché est proche de son plus haut récent.'}
                </p>
                {snapshot ? (
                  <p className="mt-1.5 text-sm font-semibold tabular-nums text-emerald-900">
                    ATH de référence :{' '}
                    {new Intl.NumberFormat('fr-FR', {
                      style: 'currency',
                      currency: settings.currency,
                      maximumFractionDigits: 2,
                      minimumFractionDigits: 2,
                    }).format(snapshot.athPrice)}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-emerald-600">ATH : en attente de données marché</p>
                )}
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Période ATH</p>
                <p className="mt-1 text-sm font-semibold text-violet-800">{settings.athPeriod}</p>
                <p className="text-xs text-violet-700">Période sur laquelle l’ATH est calculé</p>
              </div>
            </div>

            {snapshot && recommendation && decisionMessage && (
              <div
                className={`mt-3 rounded-xl border p-2.5 ${
                  recommendation.decisionType === 'STRONG_REINFORCE'
                    ? 'border-rose-200 bg-rose-50/70'
                    : recommendation.decisionType === 'MEDIUM_REINFORCE'
                      ? 'border-orange-200 bg-orange-50/70'
                      : recommendation.decisionType === 'LIGHT_REINFORCE'
                        ? 'border-amber-200 bg-amber-50/70'
                        : 'border-emerald-200 bg-emerald-50/70'
                }`}
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Assistant décisionnel</p>
                <p className="text-sm font-semibold leading-6 text-slate-900">{decisionMessage.headline}</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800">{decisionMessage.strategyBlock}</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{decisionMessage.amountLine}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Pourquoi ?</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs leading-5 text-slate-600">
                  {decisionMessage.whyBullets.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
                <div className="mt-3 rounded-lg border border-amber-200/90 bg-amber-50 px-2.5 py-2.5 shadow-sm">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-amber-950">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                    Pourquoi ne pas attendre ?
                  </p>
                  <p className="whitespace-pre-line text-xs leading-relaxed text-amber-950/90">
                    {stripImportantLeadIn(decisionMessage.importantBlock)}
                  </p>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Confiance indicative :{' '}
                  <span className="font-medium text-slate-700">
                    {recommendation.confidenceLevel === 'high' ? 'élevée' : recommendation.confidenceLevel === 'medium' ? 'moyenne' : 'prudente'}
                  </span>
                  {recommendation.prudenceMode && ' — mode prudence actif'}
                  {recommendation.recentSimilarReinforce && ' — renfort récent sur palier proche'}
                </p>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">{recommendation.reason}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={openValidation}
                    disabled={Boolean(suppressedSuggestion && recommendation.decisionType !== 'DCA_ONLY')}
                  >
                    {recommendation.decisionType === 'DCA_ONLY' ? 'DCA effectué' : 'Enregistrer l’action'}
                  </Button>
                  <Button
                    size="sm"
                    variant="soft"
                    className="h-8 px-3 text-xs"
                    onClick={openValidation}
                    disabled={Boolean(suppressedSuggestion && recommendation.decisionType !== 'DCA_ONLY')}
                  >
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    onClick={() => ignoreDecision()}
                    disabled={Boolean(suppressedSuggestion && recommendation.decisionType !== 'DCA_ONLY')}
                  >
                    Ignorer
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={requestManualAnalysis}>
                    Nouvelle analyse
                  </Button>
                  {recommendation.cashLimited && <Badge size="sm" variant="warning">Plafonné au cash</Badge>}
                  {suppressedSuggestion && recommendation.thresholdKey && (
                    <Badge size="sm" variant="secondary">Palier déjà traité récemment</Badge>
                  )}
                </div>
              </div>
            )}

            <MarketStrategySimulationCard settings={settings} />
          </CardContent>
        </Card>
      </div>
      </div>

      <Dialog open={validateOpen} onOpenChange={setValidateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider une décision d'investissement</DialogTitle>
            <DialogDescription>
              Cette action ne passe aucun ordre bancaire. Elle enregistre uniquement une décision dans Smartimmo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {recommendation && decisionMessage && (
              <p className="text-sm font-medium text-slate-800">{decisionMessage.headline}</p>
            )}
            <p className="text-sm text-slate-600">Montant recommandé : {recommendation ? formatCurrency(recommendation.suggestedAmount, settings.currency) : '-'}</p>
            <Input type="number" value={validateAmount} onChange={(e) => setValidateAmount(e.target.value)} />
            <Input value={validateReason} onChange={(e) => setValidateReason(e.target.value)} placeholder="Raison de la décision" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateOpen(false)}>Annuler</Button>
            <Button onClick={submitValidation}>
              {recommendation?.decisionType === 'DCA_ONLY' ? 'DCA effectué' : 'Enregistrer l’action'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Paramètres Marché & Investissement</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(85vh-170px)] space-y-4 overflow-y-auto pr-1">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">A. ETF suivi</p>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Preset ETF</label>
                  <select
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                    value={settingsForm.etfPreset}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === CUSTOM_MARKET_SYMBOL_KEY) {
                        setSettingsForm((p) => ({ ...p, etfPreset: value }));
                        return;
                      }
                      const alias = ETF_REFERENCE_ALIASES.find((item) => item.key === value);
                      if (!alias) return;
                      setSettingsForm((p) => ({
                        ...p,
                        etfPreset: value,
                        referenceLabel: alias.label,
                        referenceSymbol: alias.defaultProviderSymbol,
                      }));
                    }}
                  >
                    {ETF_REFERENCE_ALIASES.map((alias) => (
                      <option key={alias.key} value={alias.key}>
                        {alias.label} ({alias.defaultProviderSymbol})
                      </option>
                    ))}
                    <option value={CUSTOM_MARKET_SYMBOL_KEY}>Symbole personnalisé</option>
                  </select>
                  <p className="text-xs text-slate-500">
                    Smartimmo suit un seul ETF de référence à la fois. Après modification, les données sont automatiquement actualisées.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Libellé ETF</label>
                  <Input
                    placeholder="Ex: Amundi MSCI World UCITS ETF"
                    value={settingsForm.referenceLabel}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, referenceLabel: e.target.value, etfPreset: CUSTOM_MARKET_SYMBOL_KEY }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Symbole marché</label>
                  <Input
                    placeholder="Ex: CW8.PA"
                    value={settingsForm.referenceSymbol}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, referenceSymbol: e.target.value, etfPreset: CUSTOM_MARKET_SYMBOL_KEY }))}
                  />
                  <p className="text-xs text-slate-500">
                    Symbole utilisé : {resolveMarketSymbol(settingsForm.referenceSymbol || settings.referenceSymbol)}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Enveloppe</label>
                  <select
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                    value={settingsForm.envelope}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, envelope: e.target.value }))}
                  >
                    <option value="PEA">PEA</option>
                    <option value="CTO">CTO</option>
                    <option value="ASSURANCE_VIE">Assurance-vie</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Période ATH</label>
                  <select
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                    value={settingsForm.athPeriod}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, athPeriod: e.target.value }))}
                  >
                    <option value="5Y">ATH 5 ans</option>
                    <option value="10Y">ATH 10 ans</option>
                    <option value="MAX">ATH max</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">B. Stratégie</p>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Stratégie</label>
                  <select
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                    value={settingsForm.strategy ?? 'DCA_PLUS_REINFORCE'}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, strategy: e.target.value }))}
                  >
                    <option value="DCA_ONLY">DCA seul</option>
                    <option value="DCA_PLUS_REINFORCE">DCA + renfort</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">DCA mensuel</label>
                  <Input
                    type="number"
                    placeholder="Ex: 1000"
                    value={settingsForm.monthlyDcaAmount}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, monthlyDcaAmount: e.target.value }))}
                  />
                </div>
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Renforts (% du cash disponible)</p>
              <p className="mt-1 text-xs text-slate-500">
                Palier drawdown → part du cash restant ajoutée au DCA (plafonnée au cash, cumul DCA + renfort).
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">≤ -10 %</label>
                  <Input
                    type="number"
                    value={settingsForm.reinforceAlloc10}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, reinforceAlloc10: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">≤ -20 %</label>
                  <Input
                    type="number"
                    value={settingsForm.reinforceAlloc20}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, reinforceAlloc20: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">≤ -30 %</label>
                  <Input
                    type="number"
                    value={settingsForm.reinforceAlloc30}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, reinforceAlloc30: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">≤ -40 %</label>
                  <Input
                    type="number"
                    value={settingsForm.reinforceAlloc40}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, reinforceAlloc40: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">C. Seuils alertes (référence)</p>
              <p className="mt-1 text-xs text-slate-500">Utilisés pour les alertes internes « opportunité » / « forte opportunité » (≤ -10 %, ≤ -20 %).</p>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Seuil opportunité (%)</label>
                  <Input
                    type="number"
                    placeholder="Ex: -10"
                    value={settingsForm.reinforce10Threshold}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, reinforce10Threshold: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Montant renfort opportunité</label>
                  <Input
                    type="number"
                    placeholder="Ex: 1000"
                    value={settingsForm.reinforce10Amount}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, reinforce10Amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Seuil forte opportunité (%)</label>
                  <Input
                    type="number"
                    placeholder="Ex: -20"
                    value={settingsForm.reinforce20Threshold}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, reinforce20Threshold: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Montant renfort forte opportunité</label>
                  <Input
                    type="number"
                    placeholder="Ex: 2000"
                    value={settingsForm.reinforce20Amount}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, reinforce20Amount: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">D. Cash</p>
              <div className="mt-2 grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Cash restant à investir</label>
                  <Input
                    type="number"
                    placeholder="Ex: 15000"
                    value={settingsForm.availableCash}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, availableCash: e.target.value }))}
                  />
                  <p className="text-xs text-slate-500">Le suivi “déjà alloué” est calculé automatiquement depuis le cash initial.</p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 bg-white pt-3">
            <p className="mr-auto text-xs leading-5 text-slate-500">
              Ces paramètres sont déclaratifs, locaux à Smartimmo, et ne déclenchent aucun ordre bancaire.
            </p>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={saveCashUpdate}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
