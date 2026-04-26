'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { generateDecisionMessage } from '@/features/market/services/marketDecisionV2';
import { DEFAULT_REINFORCE_LEVELS } from '@/features/market/services/marketInvestmentStrategy';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { ChartNoAxesCombined, CircleCheckBig, Info, Lightbulb, Loader2 } from 'lucide-react';
import { useCurrentOrganization } from '@/hooks/offline/useCurrentOrganization';
import { useMarketInvestment } from '@/features/market/hooks/useMarketInvestment';
import {
  CUSTOM_MARKET_SYMBOL_KEY,
  ETF_REFERENCE_ALIASES,
  findEtfAliasFromSettings,
  normalizeMarketStorageSymbol,
  resolveMarketSymbol,
} from '@/features/market/marketSymbolAliases';
import { MarketPriceChart } from '@/features/market/components/MarketPriceChart';
import { MarketRadarPanel } from '@/features/market/components/MarketRadarPanel';
import { MarketStrategySimulationCard } from '@/features/market/components/MarketStrategySimulationCard';
import type { MarketHistoryPoint } from '@/features/market/services/marketDataService';
import type {
  AthPeriod,
  InvestmentActionLog,
  InvestmentSettings,
  MarketOpportunityStatus,
  MarketScoreLabel,
} from '@/features/market/types';
import { toast } from 'sonner';

function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

/** Prix pour stats période (2 décimales). */
function formatPriceStat(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatActionLogStatus(status: string): string {
  if (status === 'validated') return 'validé';
  if (status === 'ignored') return 'ignoré';
  if (status === 'suggested') return 'suggéré';
  return status;
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

function stripImportantLeadIn(raw: string): string {
  return raw.replace(/^Important\s*:\s*\n?/i, '').trim();
}

function allocForThreshold(settings: InvestmentSettings | null, threshold: number): string {
  if (!settings?.investmentStrategy?.reinforceLevels?.length) {
    return String(DEFAULT_REINFORCE_LEVELS.find((l) => l.threshold === threshold)?.allocationPercent ?? '');
  }
  const v = settings.investmentStrategy.reinforceLevels.find((l) => l.threshold === threshold)?.allocationPercent;
  return String(v ?? '');
}

function resolveInitialReinforceMode(settings: InvestmentSettings): 'DYNAMIC' | 'FIXED' {
  const hasDynamicValue = [-10, -20, -30, -40]
    .map((threshold) => Number(allocForThreshold(settings, threshold)))
    .some((value) => Number.isFinite(value) && value > 0);
  const hasFixedValue = [settings.reinforce10Amount, settings.reinforce20Amount]
    .some((value) => Number.isFinite(value) && value > 0);
  if (hasFixedValue && !hasDynamicValue) return 'FIXED';
  return 'DYNAMIC';
}

interface MarketInvestmentCardProps {
  openSettingsSignal?: number;
}

export function MarketInvestmentCard({ openSettingsSignal = 0 }: MarketInvestmentCardProps) {
  const compactSelectClass =
    'h-10 min-h-0 w-full rounded-xl border border-violet-200 bg-violet-50 px-3 py-0 text-sm font-medium leading-tight text-violet-800';
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
    priceHistory,
    isHistoryLoading,
    isRefreshingMarket,
    refreshCompletedAt,
    lastRefreshStatus,
    isRefreshingRadar,
    radarRefreshNote,
    radarRefreshMode,
    radarLastRefreshedAt,
    radarEntries,
    refreshAllMarketData,
    updateSettings,
    validateDecision,
    ignoreDecision,
    requestManualAnalysis,
    updateHistoryDecision,
    deleteHistoryDecision,
  } = useMarketInvestment(organizationId, { source: 'market' });

  const [editOpen, setEditOpen] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [validationMode, setValidationMode] = useState<'standard' | 'voluntary_extra'>('standard');
  const [historyEditOpen, setHistoryEditOpen] = useState(false);
  const [historyEditLogId, setHistoryEditLogId] = useState<string | null>(null);
  const [historyEditAmount, setHistoryEditAmount] = useState('');
  const [historyEditReason, setHistoryEditReason] = useState('');
  const [historyEditNote, setHistoryEditNote] = useState('');
  const [historyEditOldAmount, setHistoryEditOldAmount] = useState(0);
  const [historyEditSaving, setHistoryEditSaving] = useState(false);
  const [historyDeleteId, setHistoryDeleteId] = useState<string | null>(null);
  const [historyDeleteSaving, setHistoryDeleteSaving] = useState(false);
  const [validateAmount, setValidateAmount] = useState('');
  const [validateReason, setValidateReason] = useState('');
  const [, setRefreshAgeTick] = useState(0);
  const forceRefreshResetTimerRef = useRef<number | null>(null);
  const lastHandledOpenSettingsSignalRef = useRef(0);
  const [isForceRefreshArmed, setIsForceRefreshArmed] = useState(false);
  const [softRefreshWarning, setSoftRefreshWarning] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    reinforceMode: 'DYNAMIC' as 'DYNAMIC' | 'FIXED',
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
  const resolvedMarketSymbol = useMemo(
    () => resolveMarketSymbol(settings?.referenceSymbol ?? ''),
    [settings?.referenceSymbol]
  );
  const activeEtfOptions = useMemo(() => {
    const base = ETF_REFERENCE_ALIASES.map((alias) => ({
      key: alias.defaultProviderSymbol,
      label: `${alias.label} — ${alias.defaultProviderSymbol}`,
      referenceLabel: alias.label,
      referenceSymbol: alias.defaultProviderSymbol,
    }));
    const activeSymNorm = normalizeMarketStorageSymbol(settings?.referenceSymbol ?? '');
    const currentIsPreset = base.some((item) => normalizeMarketStorageSymbol(item.referenceSymbol) === activeSymNorm);
    if (!settings || currentIsPreset) return base;
    const sym = normalizeMarketStorageSymbol(settings.referenceSymbol);
    return [
      ...base,
      {
        key: sym,
        label: `${settings.referenceLabel || 'Symbole personnalisé'} — ${sym}`,
        referenceLabel: settings.referenceLabel || sym,
        referenceSymbol: sym,
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

  /** Ligne discrète « données à jour / prochaine MAJ » dans l’en-tête de la carte contrôles. */
  const controlsDataFreshnessLine = useMemo(() => {
    if (softRefreshWarning) {
      return { text: softRefreshWarning, className: 'text-amber-700/90' as const };
    }
    if (isRefreshingRadar) {
      return {
        text: radarRefreshNote ?? 'Actualisation des données marché…',
        className: 'text-slate-500' as const,
      };
    }
    if (radarRefreshNote) {
      if (radarRefreshMode === 'error' || radarRefreshMode === 'manual-forced') {
        return { text: radarRefreshNote, className: 'text-amber-700/90' as const };
      }
      return { text: radarRefreshNote, className: 'text-teal-600/85' as const };
    }
    const successFlash =
      lastRefreshStatus === 'success' &&
      refreshCompletedAt !== null &&
      Date.now() - new Date(refreshCompletedAt).getTime() < 6000;
    if (successFlash && nextAutoRefreshHours !== null) {
      return {
        text: `Données à jour — prochaine MAJ auto dans ${nextAutoRefreshHours} h`,
        className: 'text-teal-600/85' as const,
      };
    }
    if (nextAutoRefreshHours !== null) {
      return {
        text: `Prochaine MAJ auto dans ${nextAutoRefreshHours} h`,
        className: 'text-slate-500' as const,
      };
    }
    if (successFlash) {
      return { text: 'Données à jour', className: 'text-teal-600/85' as const };
    }
    return null;
  }, [
    softRefreshWarning,
    isRefreshingRadar,
    radarRefreshNote,
    radarRefreshMode,
    lastRefreshStatus,
    refreshCompletedAt,
    nextAutoRefreshHours,
  ]);

  /** Stats discrètes sur la série `priceHistory` (tri chronologique, sans appel réseau). */
  const pricePeriodStats = useMemo(() => {
    if (!priceHistory.length) return null;
    const points = (priceHistory as MarketHistoryPoint[])
      .map((p) => ({ date: p.date, close: Number(p.close) }))
      .filter((p) => Boolean(p.date) && Number.isFinite(p.close) && p.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (points.length < 2) return null;

    const head = points[0];
    const tail = points[points.length - 1];
    if (!head || !tail) return null;

    const firstClose = head.close;
    const lastClose = tail.close;
    const performancePct = firstClose > 0 ? ((lastClose - firstClose) / firstClose) * 100 : 0;

    let minClose = Infinity;
    let maxClose = -Infinity;
    for (const p of points) {
      if (p.close < minClose) minClose = p.close;
      if (p.close > maxClose) maxClose = p.close;
    }

    let rollingAth = head.close;
    let daysUnder10FromAth = 0;
    for (const p of points) {
      if (p.close > rollingAth) rollingAth = p.close;
      const ddAth = rollingAth > 0 ? ((p.close - rollingAth) / rollingAth) * 100 : 0;
      if (ddAth <= -10) daysUnder10FromAth += 1;
    }

    return {
      performancePct,
      minClose,
      maxClose,
      daysUnder10FromAth,
      firstHistoryDate: head.date,
      lastHistoryDate: tail.date,
    };
  }, [priceHistory]);

  const historyAvailabilityInfo = useMemo(() => {
    if (!settings || !pricePeriodStats) return null;
    const firstDate = new Date(pricePeriodStats.firstHistoryDate);
    if (!Number.isFinite(firstDate.getTime())) return null;

    const firstLabel = firstDate.toLocaleDateString('fr-FR');
    const now = new Date();
    const expectedStartByPeriod =
      settings.athPeriod === '5Y'
        ? new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
        : settings.athPeriod === '10Y'
          ? new Date(now.getFullYear() - 10, now.getMonth(), now.getDate())
          : new Date(now.getFullYear() - 20, now.getMonth(), now.getDate());
    const isLimitedHistory = firstDate.getTime() > expectedStartByPeriod.getTime();
    return { firstLabel, firstYear: firstDate.getFullYear(), isLimitedHistory };
  }, [pricePeriodStats, settings]);

  /**
   * DCA validé ce mois sur l’ETF actif (symbole + sans palier) — sert uniquement à éviter une double validation
   * DCA sur le même symbole (`blockAutoDcaDuplicate`). Inchangé vs logique métier existante.
   */
  const dcaDoneThisMonth = useMemo(() => {
    if (!settings) return { done: false as const, amount: null as number | null };
    const symbol = settings.referenceSymbol;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const validatedDcaLike = history.filter((h) => {
      if (h.status !== 'validated') return false;
      if (h.symbolAtDecision !== symbol) return false;
      if (h.thresholdKey != null) return false;
      if (!Number.isFinite(h.validatedAmount) || h.validatedAmount <= 0) return false;
      if (h.type !== 'DCA') return false;
      const d = new Date(h.date);
      if (!Number.isFinite(d.getTime())) return false;
      return d.getFullYear() === y && d.getMonth() === m;
    });

    if (validatedDcaLike.length === 0) return { done: false as const, amount: null as number | null };

    const latest = validatedDcaLike.reduce((best, row) =>
      new Date(row.date).getTime() > new Date(best.date).getTime() ? row : best
    );

    return { done: true as const, amount: latest.validatedAmount };
  }, [history, settings]);

  const isDcaDoneThisMonth = dcaDoneThisMonth.done;
  const dcaDoneThisMonthAmount = dcaDoneThisMonth.amount;

  /** DCA mensuel validé (module marché) : tout DCA du mois pour l’org, sans exiger l’ETF actuellement sélectionné. */
  const marketModuleDcaBannerInfo = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const currentMonth = `${y}-${String(m + 1).padStart(2, '0')}`;

    if (!organizationId) {
      return {
        currentMonth,
        monthlyDcaDone: 0,
        selectedLog: null as InvestmentActionLog | null,
        dcaLogsThisMonth: [] as InvestmentActionLog[],
      };
    }

    const dcaLogsThisMonth = history.filter((h) => {
      if (h.organizationId !== organizationId) return false;
      if (h.status !== 'validated') return false;
      if (h.type !== 'DCA') return false;
      if (!Number.isFinite(h.validatedAmount) || h.validatedAmount <= 0) return false;
      const d = new Date(h.date);
      if (!Number.isFinite(d.getTime())) return false;
      return d.getFullYear() === y && d.getMonth() === m;
    });

    if (dcaLogsThisMonth.length === 0) {
      return { currentMonth, monthlyDcaDone: 0, selectedLog: null, dcaLogsThisMonth };
    }

    const selectedLog = dcaLogsThisMonth.reduce((best, row) =>
      new Date(row.date).getTime() > new Date(best.date).getTime() ? row : best
    );

    return {
      currentMonth,
      monthlyDcaDone: selectedLog.validatedAmount,
      selectedLog,
      dcaLogsThisMonth,
    };
  }, [history, organizationId]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const { currentMonth, dcaLogsThisMonth, selectedLog, monthlyDcaDone } = marketModuleDcaBannerInfo;
    console.info('[MarketDcaDoneDebug]', {
      currentMonth,
      logsCount: history.length,
      dcaLogsThisMonth: dcaLogsThisMonth.map((l) => ({
        id: l.id,
        date: l.date,
        validatedAmount: l.validatedAmount,
        symbolAtDecision: l.symbolAtDecision,
        status: l.status,
        type: l.type,
      })),
      selectedLog: selectedLog
        ? {
            id: selectedLog.id,
            date: selectedLog.date,
            validatedAmount: selectedLog.validatedAmount,
            symbolAtDecision: selectedLog.symbolAtDecision,
          }
        : null,
      monthlyDcaDone,
    });
  }, [marketModuleDcaBannerInfo]);

  useEffect(() => {
    if (openSettingsSignal <= 0 || !settings) return;
    if (openSettingsSignal === lastHandledOpenSettingsSignalRef.current) return;
    lastHandledOpenSettingsSignalRef.current = openSettingsSignal;
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

  const blockAutoDcaDuplicate =
    recommendation != null &&
    recommendation.decisionType === 'DCA_ONLY' &&
    recommendation.status === 'NORMAL' &&
    isDcaDoneThisMonth;

  const validationPrimaryLabel =
    recommendation?.decisionType === 'DCA_ONLY'
      ? 'Valider ce DCA'
      : recommendation?.decisionType === 'STRONG_REINFORCE'
        ? 'Valider le renfort fort'
        : recommendation?.decisionType === 'LIGHT_REINFORCE' || recommendation?.decisionType === 'MEDIUM_REINFORCE'
          ? 'Valider le renfort'
          : 'Enregistrer l’action';

  const validationSubmitLabel =
    validationMode === 'voluntary_extra'
      ? 'Enregistrer l’investissement'
      : validationPrimaryLabel;
  const hasAnyDcaDoneThisMonth = marketModuleDcaBannerInfo.monthlyDcaDone > 0;
  const validationAssistantPrimaryLabel =
    hasAnyDcaDoneThisMonth && recommendation?.decisionType === 'DCA_ONLY'
      ? 'Réinvestir ce mois'
      : validationPrimaryLabel;
  const recommendedDcaAmount = recommendation?.monthlyDcaPortion ?? settings.monthlyDcaAmount;
  const hasSufficientCashForDca = settings.availableCash >= recommendedDcaAmount;

  const openHistoryEdit = (item: InvestmentActionLog) => {
    setHistoryEditLogId(item.id);
    setHistoryEditOldAmount(item.validatedAmount);
    setHistoryEditAmount(String(item.validatedAmount));
    setHistoryEditReason(item.reason);
    setHistoryEditNote(item.note ?? '');
    setHistoryEditOpen(true);
  };

  const submitHistoryEdit = async () => {
    if (!historyEditLogId) return;
    const n = Number(historyEditAmount);
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Montant invalide');
      return;
    }
    const maxAllowed = settings.availableCash + historyEditOldAmount;
    if (n > maxAllowed + 1e-6) {
      toast.error('Montant invalide');
      return;
    }
    setHistoryEditSaving(true);
    try {
      const outcome = await updateHistoryDecision(historyEditLogId, {
        validatedAmount: n,
        reason: historyEditReason,
        note: historyEditNote.trim() === '' ? null : historyEditNote.trim(),
      });
      if (outcome === 'ok') {
        toast.success('Décision modifiée');
        setHistoryEditOpen(false);
        setHistoryEditLogId(null);
      } else if (outcome === 'invalid_amount') {
        toast.error('Montant invalide');
      } else {
        toast.error('Modification impossible');
      }
    } catch {
      toast.error('Modification impossible');
    } finally {
      setHistoryEditSaving(false);
    }
  };

  const confirmHistoryDelete = async () => {
    if (!historyDeleteId) return;
    setHistoryDeleteSaving(true);
    try {
      const outcome = await deleteHistoryDecision(historyDeleteId);
      if (outcome === 'ok') {
        toast.success('Décision supprimée');
        setHistoryDeleteId(null);
      } else if (outcome === 'failed') {
        toast.error('Suppression impossible');
      } else {
        toast.error('Suppression impossible');
      }
    } catch {
      toast.error('Suppression impossible');
    } finally {
      setHistoryDeleteSaving(false);
    }
  };

  const openValidation = (mode: 'standard' | 'voluntary_extra' = 'standard') => {
    if (!recommendation) return;
    setValidationMode(mode);
    setValidateAmount(String(recommendation.suggestedAmount));
    setValidateReason(mode === 'voluntary_extra' ? '' : recommendation.reason);
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

  const handleAthPeriodChange = async (nextPeriod: AthPeriod) => {
    if (!settings || nextPeriod === settings.athPeriod) return;
    try {
      await updateSettings({ athPeriod: nextPeriod });
    } catch {
      toast.error('Impossible d’enregistrer la période ATH');
    }
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
      `Données déjà récentes — dernière MAJ il y a ${relative}. Cliquez à nouveau pour confirmer une actualisation forcée.`
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
    if (
      !window.confirm(
        'Les données ont déjà été actualisées récemment. Les API gratuites peuvent être limitées. Voulez-vous forcer l’actualisation ?'
      )
    ) {
      resetForceRefreshState();
      return;
    }
    resetForceRefreshState();
    await refreshAllMarketData();
  };

  const submitValidation = async () => {
    const wasDcaOnly = recommendation?.decisionType === 'DCA_ONLY';
    const voluntary = validationMode === 'voluntary_extra';
    const amount = Number(validateAmount);
    try {
      await validateDecision(amount, validateReason, undefined, {
        voluntaryAdditionalInvestment: voluntary,
      });
      setValidateOpen(false);
      setValidationMode('standard');
      if (voluntary && Number.isFinite(amount) && amount > 0) {
        toast.success('Investissement enregistré');
      } else if (wasDcaOnly && !voluntary && Number.isFinite(amount) && amount > 0) {
        toast.success('DCA enregistré');
      }
    } catch {
      toast.error('Enregistrement impossible');
    }
  };
  const openSettingsFromValidation = () => {
    setValidateOpen(false);
    window.setTimeout(() => openSettingsModal(), 0);
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
      : normalizeMarketStorageSymbol(settingsForm.referenceSymbol.trim());
    const nextLabel = selectedAlias ? selectedAlias.label : settingsForm.referenceLabel.trim();

    try {
      setIsSavingSettings(true);
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
      toast.success('Paramètres enregistrés');
    } catch {
      toast.error('Échec de la sauvegarde des paramètres');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const openSettingsModal = () => {
    setSettingsForm({
      reinforceMode: resolveInitialReinforceMode(settings),
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
    <div className="w-full space-y-6">
      <MarketRadarPanel
        entries={radarEntries}
        currency={settings.currency}
        lastUpdatedAt={radarLastRefreshedAt}
        athPeriod={settings.athPeriod}
      />

      <Card className="w-full border-slate-200 bg-white shadow-sm" padding="none">
        <CardContent className="flex flex-col gap-3 px-4 py-3">
          <div className="flex w-full flex-col gap-3">
            <div className="flex w-full flex-col">
              <label htmlFor="market-active-etf" className="mb-1 text-xs font-medium leading-none text-gray-500">
                ETF actif
              </label>
              <select
                id="market-active-etf"
                className={compactSelectClass}
                value={settings.referenceSymbol}
                onChange={(e) => handleActiveEtfChange(e.target.value).catch(() => undefined)}
                disabled={isRefreshingMarket || isRefreshingRadar}
              >
                {activeEtfOptions.map((option) => (
                  <option key={option.key} value={option.referenceSymbol}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-full flex-col">
              <label htmlFor="market-ath-period" className="mb-1 text-xs font-medium leading-none text-gray-500">
                Période ATH
              </label>
              <select
                id="market-ath-period"
                className={compactSelectClass}
                value={settings.athPeriod}
                onChange={(e) =>
                  handleAthPeriodChange(e.target.value as AthPeriod).catch(() => undefined)
                }
                disabled={isRefreshingMarket || isRefreshingRadar}
              >
                <option value="5Y">5 ans</option>
                <option value="10Y">10 ans</option>
                <option value="MAX">Max</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
          {controlsDataFreshnessLine && (
            <p
              className={`w-full border-t border-slate-100 pt-2 text-[11px] font-normal leading-snug ${controlsDataFreshnessLine.className}`}
            >
              {controlsDataFreshnessLine.text}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-4 py-4">
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
                isRefreshing={isRefreshingMarket || isRefreshingRadar}
                etfLabel={settings.referenceLabel}
                etfSymbol={resolvedMarketSymbol || settings.referenceSymbol}
              />
            ) : (
              <div className="flex min-h-[220px] flex-col justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6">
                <p className="text-center text-sm leading-6 text-slate-700">
                  {marketError ??
                    'Données non chargées pour cette période — cliquez sur Actualiser.'}
                </p>
              </div>
            )}
            {snapshot && historyAvailabilityInfo?.isLimitedHistory && (
              <div className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2">
                <p className="text-xs text-gray-500">
                  Historique disponible depuis :{' '}
                  <span className="font-medium text-slate-700">{historyAvailabilityInfo.firstLabel}</span>
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Cet ETF est récent, les données antérieures ne sont pas disponibles.
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  La période sélectionnée est plus longue que l’historique réel de cet ETF.
                </p>
              </div>
            )}
            {snapshot && pricePeriodStats && !isRefreshingMarket && !isHistoryLoading && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Statistiques sur la période
                </p>
                <p className="mb-2 text-xs text-slate-500">Calculées sur l’historique disponible</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 md:grid-cols-4">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Performance</p>
                    <p
                      className={`truncate text-sm font-semibold tabular-nums ${
                        pricePeriodStats.performancePct >= 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {pricePeriodStats.performancePct >= 0 ? '+' : ''}
                      {pricePeriodStats.performancePct.toFixed(1).replace('.', ',')} %
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Plus bas</p>
                    <p className="truncate text-sm font-semibold tabular-nums text-slate-800">
                      {formatPriceStat(pricePeriodStats.minClose, settings.currency)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Plus haut</p>
                    <p className="truncate text-sm font-semibold tabular-nums text-slate-800">
                      {formatPriceStat(pricePeriodStats.maxClose, settings.currency)}
                    </p>
                  </div>
                  <div className="min-w-0 col-span-2 md:col-span-1">
                    <p className="text-xs text-slate-500">Jours ≤ −10 % vs sommet</p>
                    <p className="truncate text-sm font-semibold tabular-nums text-slate-800">
                      {pricePeriodStats.daysUnder10FromAth}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {snapshot && !isRefreshingMarket && !isHistoryLoading && priceHistory.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
                <p className="text-xs text-slate-600">
                  Données non chargées pour cette période — cliquez sur Actualiser
                </p>
              </div>
            )}

          </CardContent>
      </Card>

      {snapshot && recommendation && decisionMessage && (
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Assistant décisionnel</p>
                    <p className="text-sm font-semibold leading-6 text-slate-900">{decisionMessage.headline}</p>
                  </div>
                  <div className="shrink-0 self-start rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs sm:text-right">
                    <p className="font-semibold text-slate-800">
                      💰 Cash disponible : {formatCurrency(settings.availableCash, settings.currency)}
                    </p>
                    <p className={`mt-0.5 font-medium ${hasSufficientCashForDca ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {hasSufficientCashForDca ? '✔ suffisant pour DCA' : '⚠ insuffisant pour DCA'}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="whitespace-pre-line text-sm leading-6 text-slate-800">{decisionMessage.strategyBlock}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{decisionMessage.amountLine}</p>
                </div>
                {marketModuleDcaBannerInfo.monthlyDcaDone > 0 && marketModuleDcaBannerInfo.selectedLog && (
                  <div className="mt-3 rounded-lg border border-green-300 bg-green-100 p-3">
                    <p className="flex items-center gap-2 text-base font-semibold text-green-900">
                      <CircleCheckBig className="h-5 w-5 shrink-0 text-green-700" aria-hidden />
                      DCA effectue ce mois
                    </p>
                    <p className="mt-1 text-base font-medium text-green-900">
                      {formatCurrency(marketModuleDcaBannerInfo.monthlyDcaDone, settings.currency)} sur {marketModuleDcaBannerInfo.selectedLog.symbolAtDecision}
                    </p>
                  </div>
                )}
                <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Pourquoi ?</p>
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
                    className={`h-8 px-3 text-xs ${hasAnyDcaDoneThisMonth && recommendation?.decisionType === 'DCA_ONLY' ? 'opacity-90' : ''}`}
                    onClick={() =>
                      openValidation(
                        hasAnyDcaDoneThisMonth && recommendation.decisionType === 'DCA_ONLY' ? 'voluntary_extra' : 'standard'
                      )
                    }
                    disabled={Boolean(suppressedSuggestion && recommendation.decisionType !== 'DCA_ONLY')}
                  >
                    {validationAssistantPrimaryLabel}
                  </Button>
                  <Button
                    size="sm"
                    variant="soft"
                    className="h-8 px-3 text-xs"
                    onClick={() => openValidation(blockAutoDcaDuplicate ? 'voluntary_extra' : 'standard')}
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
          </CardContent>
        </Card>
      )}

      <MarketStrategySimulationCard settings={settings} snapshot={snapshot} />

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="space-y-6 py-4">
          <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm">
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
                  {item.updatedAt && (
                    <p className="mt-0.5 text-[11px] text-slate-400">Modifié le {new Date(item.updatedAt).toLocaleString('fr-FR')}</p>
                  )}
                  <p className="text-xs leading-5 text-slate-500">
                    {item.type === 'DCA' ? 'DCA' : item.type === 'MANUAL' ? 'Montant manuel' : 'Renfort'} • {formatActionLogStatus(item.status)} • {item.symbolAtDecision}
                  </p>
                  <p className="text-xs leading-5 text-slate-500">
                    ATH {item.athPriceAtDecision?.toFixed(2) ?? '-'} • Prix {item.currentPriceAtDecision?.toFixed(2) ?? '-'}
                  </p>
                  <p className="text-xs leading-5 text-slate-500">
                    Cash {formatCurrency(item.cashBefore, settings.currency)} → {formatCurrency(item.cashAfter, settings.currency)} • Période {item.athPeriodAtDecision}
                  </p>
                  {item.status === 'validated' && (
                    <div className="mt-2 flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] font-medium text-slate-600"
                        onClick={() => openHistoryEdit(item)}
                      >
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px] font-medium text-slate-600"
                        onClick={() => setHistoryDeleteId(item.id)}
                      >
                        Supprimer
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
            <p className="text-xs leading-5 text-slate-500">
              Cash disponible (rappel) : {formatCurrency(settings.availableCash, settings.currency)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={validateOpen}
        onOpenChange={(open) => {
          setValidateOpen(open);
          if (!open) setValidationMode('standard');
        }}
      >
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-20px)] flex-col overflow-hidden p-3 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Valider une décision d'investissement</DialogTitle>
            <DialogDescription>
              Cette action ne passe aucun ordre bancaire. Elle enregistre uniquement une décision dans Smartimmo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 pb-2">
            {validationMode === 'voluntary_extra' && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 text-xs leading-relaxed text-sky-950">
                Cette action est un investissement supplémentaire. Elle ne modifie pas votre DCA mensuel.
              </div>
            )}
            {recommendation && decisionMessage && (
              <p className="text-sm font-medium text-slate-800">{decisionMessage.headline}</p>
            )}
            <p className="text-sm text-slate-600">
              Montant recommandé initial : {recommendation ? formatCurrency(recommendation.suggestedAmount, settings.currency) : '-'}
            </p>
            <div className="space-y-1">
              <label htmlFor="validate-amount" className="text-xs font-medium text-slate-700">
                Montant à enregistrer pour cette décision
              </label>
              <Input
                id="validate-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={validateAmount}
                onChange={(e) => setValidateAmount(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Ce montant concerne uniquement cette décision. Votre DCA mensuel reste inchangé.
              </p>
            </div>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
              DCA mensuel paramétré : {formatCurrency(settings.monthlyDcaAmount, settings.currency)}
            </p>
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={openSettingsFromValidation}>
              Modifier le DCA global
            </Button>
            <div className="space-y-1">
              <label htmlFor="validate-reason" className="text-xs font-medium text-slate-700">
                Raison / note (optionnel)
              </label>
              <Input
                id="validate-reason"
                value={validateReason}
                onChange={(e) => setValidateReason(e.target.value)}
                placeholder="Raison de la décision"
              />
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 z-10 border-t border-slate-200 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setValidateOpen(false)}>Annuler</Button>
            <Button className="w-full sm:w-auto" onClick={submitValidation}>
              {validationSubmitLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={historyEditOpen}
        onOpenChange={(open) => {
          setHistoryEditOpen(open);
          if (!open) setHistoryEditLogId(null);
        }}
      >
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-20px)] flex-col overflow-hidden p-3 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier la décision</DialogTitle>
            <DialogDescription>
              Seuls le montant validé et la raison / note peuvent être modifiés. Le type, le symbole et le contexte marché enregistrés à la date de la décision restent inchangés.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 pb-2">
            <p className="text-xs text-slate-500">
              Montant max :{' '}
              <span className="font-medium text-slate-700">
                {formatCurrency(settings.availableCash + historyEditOldAmount, settings.currency)}
              </span>{' '}
              (cash disponible + montant de cette décision).
            </p>
            <div className="space-y-1">
              <label htmlFor="hist-edit-amt" className="text-xs font-medium text-slate-700">
                Montant validé
              </label>
              <Input
                id="hist-edit-amt"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                value={historyEditAmount}
                onChange={(e) => setHistoryEditAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="hist-edit-reason" className="text-xs font-medium text-slate-700">
                Raison
              </label>
              <Input id="hist-edit-reason" value={historyEditReason} onChange={(e) => setHistoryEditReason(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label htmlFor="hist-edit-note" className="text-xs font-medium text-slate-700">
                Note (optionnel)
              </label>
              <Input id="hist-edit-note" value={historyEditNote} onChange={(e) => setHistoryEditNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 z-10 border-t border-slate-200 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={() => setHistoryEditOpen(false)}
              disabled={historyEditSaving}
            >
              Annuler
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => submitHistoryEdit().catch(() => undefined)} disabled={historyEditSaving}>
              {historyEditSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDeleteId !== null} onOpenChange={(open) => { if (!open) setHistoryDeleteId(null); }}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-20px)] flex-col overflow-hidden p-3 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer cette décision ?</DialogTitle>
            <DialogDescription>Le cash restant sera recalculé.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="sticky bottom-0 z-10 border-t border-slate-200 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={() => setHistoryDeleteId(null)}
              disabled={historyDeleteSaving}
            >
              Annuler
            </Button>
            <Button
              className="w-full sm:w-auto"
              variant="primary"
              onClick={() => confirmHistoryDelete().catch(() => undefined)}
              disabled={historyDeleteSaving}
            >
              {historyDeleteSaving ? 'Suppression...' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-20px)] flex-col overflow-hidden p-3 sm:max-h-[85vh] sm:max-w-3xl">
          <DialogHeader className="pr-8">
            <DialogTitle>Paramètres Marché & Investissement</DialogTitle>
          </DialogHeader>
          <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1 pb-2">
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
                        setSettingsForm((p) => ({
                          ...p,
                          etfPreset: value,
                          referenceLabel: '',
                          referenceSymbol: '',
                        }));
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
                  {settingsForm.etfPreset === CUSTOM_MARKET_SYMBOL_KEY && (
                    <p className="text-xs text-violet-700">
                      Mode personnalisé : vous saisissez votre propre ETF (source Yahoo Finance)
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Libellé ETF</label>
                  <Input
                    placeholder={settingsForm.etfPreset === CUSTOM_MARKET_SYMBOL_KEY ? 'Ex: MSCI World perso' : 'Ex: Amundi MSCI World UCITS ETF'}
                    value={settingsForm.referenceLabel}
                    onChange={(e) => setSettingsForm((p) => ({ ...p, referenceLabel: e.target.value, etfPreset: CUSTOM_MARKET_SYMBOL_KEY }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Symbole marché</label>
                  <Input
                    placeholder={settingsForm.etfPreset === CUSTOM_MARKET_SYMBOL_KEY ? 'Ex: VWCE.DE' : 'Ex: CW8.PA'}
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
                    onChange={(e) =>
                      setSettingsForm((p) => ({ ...p, athPeriod: e.target.value as InvestmentSettings['athPeriod'] }))
                    }
                  >
                    <option value="5Y">ATH 5 ans</option>
                    <option value="10Y">ATH 10 ans</option>
                    <option value="MAX">ATH max</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Mode de renfort</label>
                <select
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  value={settingsForm.reinforceMode}
                  onChange={(e) => {
                    const value = e.target.value === 'FIXED' ? 'FIXED' : 'DYNAMIC';
                    setSettingsForm((p) => ({ ...p, reinforceMode: value }));
                  }}
                >
                  <option value="DYNAMIC">Dynamique (% du cash)</option>
                  <option value="FIXED">Montant fixe</option>
                </select>
              </div>
              <div className="mt-2 rounded-md border border-slate-200 bg-white/75 px-2.5 py-2">
                <p className="text-xs text-slate-700">
                  Deux approches possibles : renfort en % du cash (dynamique) ou renfort en montant fixe.
                </p>
                <p className="mt-1 text-xs font-medium text-slate-800">
                  Mode actif : {settingsForm.reinforceMode === 'DYNAMIC' ? 'Dynamique (% du cash)' : 'Montant fixe'}
                </p>
              </div>
            </div>

            {settingsForm.reinforceMode === 'DYNAMIC' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">💡 B. Stratégie d’investissement</p>
              <p className="mt-1 text-xs text-amber-900">
                Définit comment vous investissez : DCA mensuel (investissement régulier) et renforts automatiques en cas de baisse du marché.
              </p>
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
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-amber-700">Renforts (% du cash disponible)</p>
              <p className="mt-1 text-xs text-slate-500">
                % du cash investi automatiquement selon la baisse du marché.
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
            )}

            {settingsForm.reinforceMode === 'FIXED' && (
            <div className="rounded-lg border border-orange-200 bg-orange-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-700">⚠️ C. Seuils d’opportunité (montants fixes)</p>
              <p className="mt-1 text-xs text-orange-900">Montants fixes proposés lorsque certains niveaux de baisse sont atteints.</p>
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
            )}

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
          <DialogFooter className="sticky bottom-0 z-10 border-t border-slate-200 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
            <p className="mr-auto text-xs leading-5 text-slate-500">
              Ces paramètres sont déclaratifs, locaux à Smartimmo, et ne déclenchent aucun ordre bancaire.
            </p>
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setEditOpen(false)} disabled={isSavingSettings}>Annuler</Button>
            <Button className="w-full sm:w-auto" onClick={saveCashUpdate} disabled={isSavingSettings}>
              {isSavingSettings ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
