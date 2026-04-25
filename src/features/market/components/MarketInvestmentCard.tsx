'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { ChartNoAxesCombined, Info, Loader2, Sparkles, WalletCards } from 'lucide-react';
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
import type { InvestmentSettings, MarketOpportunityStatus } from '@/features/market/types';

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

function DrawdownBar({
  drawdownPercent,
  reinforce10Threshold,
  reinforce20Threshold,
}: {
  drawdownPercent: number;
  reinforce10Threshold: number;
  reinforce20Threshold: number;
}) {
  const clampToBar = (value: number) => Math.max(-40, Math.min(0, value));
  const clamped = Math.max(-40, Math.min(0, drawdownPercent));
  const markerLeft = ((clamped + 40) / 40) * 100;
  const level10 = ((clampToBar(reinforce10Threshold) + 40) / 40) * 100;
  const level20 = ((clampToBar(reinforce20Threshold) + 40) / 40) * 100;

  return (
    <div className="space-y-2">
      <div className="relative h-3 rounded-full bg-slate-200">
        <div className="absolute left-0 top-0 h-3 w-full rounded-full bg-gradient-to-r from-red-300 via-amber-300 to-emerald-400" />
        <div className="absolute top-[-2px] h-4 w-1 rounded bg-slate-900" style={{ left: `${markerLeft}%` }} />
      </div>
      <div className="relative text-xs text-slate-500">
        <span className="inline-block">-40%</span>
        <span className="absolute top-0 -translate-x-1/2" style={{ left: `${level20}%` }}>{formatPct(reinforce20Threshold)}</span>
        <span className="absolute top-0 -translate-x-1/2" style={{ left: `${level10}%` }}>{formatPct(reinforce10Threshold)}</span>
        <span className="float-right">0%</span>
      </div>
    </div>
  );
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
    availableCash: '',
  });

  const snapshotStatus = useMemo(() => {
    if (!recommendation) return null;
    return statusBadge(recommendation.status);
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
    if (![cash, dca, r10, r20].every((v) => Number.isFinite(v) && v >= 0)) return;
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

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 xl:items-stretch">
      <Card className="min-w-0 border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3.5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <h3 className="text-[15px] font-semibold leading-6 text-slate-900">Marché & Investissement</h3>
            <p className="text-xs leading-5 text-slate-500">Module décisionnel ETF local-first</p>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">ETF actif</label>
              <select
                className="h-8 min-w-[250px] rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-medium text-violet-800"
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
          </div>
          <div className="flex items-center gap-2">
            {snapshotStatus && <Badge size="sm" variant={snapshotStatus.variant}>{snapshotStatus.label}</Badge>}
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
        </div>
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
            <p className="text-xs leading-5 text-slate-500">
              ETF actif : {settings.referenceLabel} ({resolvedMarketSymbol || settings.referenceSymbol})
            </p>
            <p className="text-xs leading-5 text-slate-500">Symbole marché : {resolvedMarketSymbol || settings.referenceSymbol}</p>
            <p className="text-xs leading-5 text-slate-500">Source : {sourceLabel}</p>
            <p className="mt-1.5 text-xs text-slate-500">Cash restant à investir :</p>
            <p className="text-xl font-semibold leading-6 text-emerald-700">{formatCurrency(settings.availableCash, settings.currency)}</p>
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
              <Badge size="sm" variant="secondary">ATH calculé sur : {athPeriodLabel}</Badge>
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
                <DrawdownBar
                  drawdownPercent={snapshot.drawdownPercent}
                  reinforce10Threshold={settings.reinforce10Threshold}
                  reinforce20Threshold={settings.reinforce20Threshold}
                />
              </div>
            )}

            {snapshot && recommendation && (
              <div
                className={`rounded-xl border p-2.5 ${
                  recommendation.status === 'FORTE_OPPORTUNITE'
                    ? 'border-rose-200 bg-rose-50/70'
                    : recommendation.status === 'OPPORTUNITE'
                    ? 'border-amber-200 bg-amber-50/70'
                    : 'border-emerald-200 bg-emerald-50/70'
                }`}
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Décision</p>
                <p className="text-sm leading-5 text-slate-700">Marché : <span className="font-semibold">{formatDrawdownPercent(snapshot.drawdownPercent)} sous le plus haut de référence</span></p>
                {recommendation.status === 'NORMAL' ? (
                  <p className="text-sm leading-5 text-slate-700">DCA mensuel prévu : <span className="font-semibold">{formatCurrency(settings.monthlyDcaAmount, settings.currency)}</span></p>
                ) : (
                  <p className="text-sm leading-5 text-slate-700">Suggestion : <span className="font-semibold">{formatCurrency(recommendation.suggestedAmount, settings.currency)}</span></p>
                )}
                <p className="text-sm leading-5 text-slate-700">{recommendation.message}</p>
                <p className="text-xs leading-5 text-slate-500">{recommendation.reason}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recommendation.status !== 'NORMAL' && (
                    <Button size="sm" className="h-8 px-3 text-xs" onClick={openValidation} disabled={suppressedSuggestion}>
                      Valider l'investissement
                    </Button>
                  )}
                  {recommendation.status !== 'NORMAL' && (
                    <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => ignoreDecision()} disabled={suppressedSuggestion}>
                      Ignorer
                    </Button>
                  )}
                  {recommendation.status !== 'NORMAL' && (
                    <Button size="sm" variant="soft" className="h-8 px-3 text-xs" onClick={openValidation} disabled={suppressedSuggestion}>
                      Modifier le montant
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={requestManualAnalysis}>
                    Nouvelle analyse
                  </Button>
                  {recommendation.cashLimited && <Badge size="sm" variant="warning">cash limité</Badge>}
                  {suppressedSuggestion && <Badge size="sm" variant="secondary">Seuil déjà traité récemment</Badge>}
                </div>
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
          <p className="mb-2 text-sm font-medium text-slate-900">Historique décisions</p>
          <div className="space-y-1.5">
            {history.length === 0 && <p className="text-sm text-slate-500">Aucune décision enregistrée pour le moment.</p>}
            {history.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium leading-5 text-slate-900">{new Date(item.date).toLocaleDateString('fr-FR')} — {item.status}</span>
                  <span className="text-sm leading-5 text-slate-700">{formatCurrency(item.validatedAmount, settings.currency)}</span>
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  {item.reason} • {item.symbolAtDecision} • {item.marketStatusAtDecision}
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
            <p className="text-sm text-slate-600">Montant recommandé : {recommendation ? formatCurrency(recommendation.suggestedAmount, settings.currency) : '-'}</p>
            <Input type="number" value={validateAmount} onChange={(e) => setValidateAmount(e.target.value)} />
            <Input value={validateReason} onChange={(e) => setValidateReason(e.target.value)} placeholder="Raison de la décision" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateOpen(false)}>Annuler</Button>
            <Button onClick={submitValidation}>Valider</Button>
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
            </div>

            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">C. Seuils de décision</p>
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
