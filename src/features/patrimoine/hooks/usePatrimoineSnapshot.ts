/**
 * Agrège Patrimoine immobilier (IDB), simulation fiscale sauvegardée, module marché et saisies utilisateur.
 * Local-first : IndexedDB + paramètres localStorage.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getLocalDB } from '@/lib/offline/db';
import type { LocalLoan } from '@/lib/offline/db';
import { getPropertyRepositoryOffline } from '@/lib/offline/repositories/PropertyRepositoryOffline';
import { getLoanRepositoryOffline } from '@/lib/offline/repositories/LoanRepositoryOffline';
import { buildSchedule, crdAtDate, type ScheduleRow } from '@/lib/finance/amortization';
import type {
  InvestmentActionLog,
  InvestmentRecommendation,
  MarketOpportunityStatus,
  MarketScoreLabel,
  MarketSnapshot,
} from '@/features/market/types';
import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';
import { computeInvestmentRecommendation } from '@/features/market/services/marketDecisionV2';
import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';
import { resolveMinCashReservePercent } from '@/features/market/services/marketGuardrails';
import type { PatrimoineUserSettings, PatrimoineObjective } from '@/features/patrimoine/store/patrimoineSettings';
import {
  buildAvailableFiscalSimulations,
  parseFiscalInputs,
  parseSimulationResult,
  resolveFiscalSimulationForPatrimoine,
  type FiscalSimulationSelectionMode,
  type PatrimoineAvailableFiscalSimulation,
} from '@/features/patrimoine/services/patrimoineFiscalSelection';
import {
  buildAvailableMarketInvestmentsForPatrimoine,
  formatPatrimoineMarketProfileLabel,
  resolvePatrimoineMarketInvestment,
  type MarketInvestmentSelectionMode,
  type PatrimoineAvailableMarketInvestment,
} from '@/features/patrimoine/services/patrimoineMarketSelection';
import { computeAllocationScore } from '@/features/patrimoine/services/patrimoineAllocationScore';
import {
  buildPatrimoineDecisionInput,
  computePatrimoineRecommendation,
  computePriorityActions,
  type PatrimoineRecommendationResult,
  type PriorityActionItem,
} from '@/features/patrimoine/services/patrimoineDecisionService';
import {
  computeCashflowProjection,
  type PatrimoineProjectionTrend,
} from '@/features/patrimoine/services/patrimoineProjectionService';

export const DEFAULT_ETF_ANNUAL_YIELD = 0.07;

/** Origine affichée pour cash / montant DCA cockpit (profil Marché vs saisie Patrimoine). */
export type PatrimoineAmountSource = 'MARKET' | 'PATRIMOINE';

export interface PatrimoineNextEvents {
  nextTaxPayment: string | null;
  nextDcaDate: string | null;
  nextLoanPayment: string | null;
}

export interface PatrimoineDecisionFlags {
  isMarketHigh: boolean;
  isMarketOpportunity: boolean;
  hasTooMuchCash: boolean;
  isImmoHeavy: boolean;
}

export interface PatrimoineSnapshotResult {
  immobilierBrut: number;
  dette: number;
  immobilierNet: number;
  revenuLocatifNet: number;
  peaEtfValue: number;
  cashDisponible: number;
  cashSecurite: number;
  patrimoineNetGlobal: number;
  revenuGlobalEstime: number;
  marketRecommendation: InvestmentRecommendation | null;
  dcaRecommended: number;
  reinforceRecommended: number;
  rendementEtfAnnuel: number;
  reserveCashMoteur: number;
  drawdownPercent: number | null;
  athDistancePercent: number | null;
  scoreAllocation: number;
  allocationEtf: number;
  allocationImmo: number;
  cashExcess: number;
  investableCash: number;
  decisionFlags: PatrimoineDecisionFlags;
  marketScore: number | null;
  marketScoreLabel: MarketScoreLabel | null;
  marketStatus: MarketOpportunityStatus | null;
  fiscalSimulationId: string | null;
  fiscalYear: number | null;
  hasFiscalSimulation: boolean;
  patrimoineReco: PatrimoineRecommendationResult;
  /** Revenu locatif net / 12 (hors prorata calendrier) */
  monthlyCapacity: number;
  effortFiscalMensuel: number | null;
  netMonthlyFreeCash: number;
  fiscalResteAPayer: number | null;
  fiscalMonthsRemaining: number | null;
  nextEvents: PatrimoineNextEvents;
  priorityActions: PriorityActionItem[];
  userObjective: PatrimoineObjective;
  effectiveDcaDayOfMonth: number;
  /** Snapshot marché présent (symbole / cours utilisés par la reco investissement). */
  hasMarketData: boolean;
  /** Projection indicative 5 ans — tendance agrégée */
  projectionTrend: PatrimoineProjectionTrend;
  /** Variation relative du patrimoine sur la fenêtre de projection (ex. 0.08 = +8 %) */
  projectionPatrimoineDeltaRatio: number;
  /** Simulation fiscale effectivement utilisée pour les agrégats (peut différer du choix si fallback). */
  selectedFiscalSimulationId: string | null;
  fiscalSimulationSelectionMode: FiscalSimulationSelectionMode;
  availableFiscalSimulations: PatrimoineAvailableFiscalSimulation[];
  /** Message utilisateur si le choix manuel est introuvable ou illisible. */
  fiscalSimulationWarning: string | null;
  /** Profil marché effectivement utilisé pour ETF / DCA / marché (null si aucun profil local). */
  selectedMarketInvestmentId: string | null;
  marketInvestmentSelectionMode: MarketInvestmentSelectionMode;
  availableMarketInvestments: PatrimoineAvailableMarketInvestment[];
  marketSelectionWarning: string | null;
  /** Cash disponible cockpit : profil Marché (`availableCash`) si profil résolu, sinon hypothèses. */
  sourceCash: PatrimoineAmountSource;
  /** Montant DCA de référence : moteur Marché si profil résolu, sinon logique Patrimoine. */
  sourceDca: PatrimoineAmountSource;
  /** Jour de versement DCA : `monthlyInvestmentDay` du profil Marché si défini, sinon hypothèse. */
  sourceDcaDay: PatrimoineAmountSource;
  /** Libellé du profil marché effectif (symbole · DCA · cash). */
  marketProfileSummary: string | null;
  loading: boolean;
  error: string | null;
}

export type {
  PatrimoineAvailableFiscalSimulation,
  FiscalSimulationSelectionMode,
  PatrimoineAvailableMarketInvestment,
  MarketInvestmentSelectionMode,
  PatrimoineAmountSource,
};

function monthKeyNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function computeAthDistancePercent(marketSnap: MarketSnapshot | null): number | null {
  if (!marketSnap) return null;
  const { athPrice, currentPrice } = marketSnap;
  if (!Number.isFinite(athPrice) || athPrice <= 0 || !Number.isFinite(currentPrice)) return null;
  const raw = ((athPrice - currentPrice) / athPrice) * 100;
  return Math.round(Math.max(0, raw) * 100) / 100;
}

function nextSeptemberDeadline(declarationYear: number, now: Date): { date: Date; monthsRemaining: number } {
  let y = declarationYear;
  let target = new Date(y, 8, 15, 12, 0, 0, 0);
  while (target < now) {
    y += 1;
    target = new Date(y, 8, 15, 12, 0, 0, 0);
  }
  const diffMs = target.getTime() - now.getTime();
  const monthsRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30.4)));
  return { date: target, monthsRemaining };
}

function parseScheduleRowDate(s: string): Date {
  if (s.length === 7) {
    return new Date(`${s}-01T12:00:00`);
  }
  if (s.length === 10) {
    return new Date(`${s}T12:00:00`);
  }
  return new Date(s);
}

function computeNextLoanPaymentIso(loans: LocalLoan[]): string | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let best: Date | null = null;
  for (const loan of loans.filter((l) => l.isActive)) {
    try {
      const schedule: ScheduleRow[] = buildSchedule({
        principal: Number(loan.principal),
        annualRatePct: Number(loan.annualRatePct),
        durationMonths: loan.durationMonths,
        defermentMonths: loan.defermentMonths || 0,
        insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
        startDate: new Date(loan.startDate),
        paymentDay: loan.paymentDay || undefined,
      });
      for (const row of schedule) {
        const d = parseScheduleRowDate(row.date);
        if (d >= now) {
          if (!best || d < best) {
            best = d;
          }
        }
      }
    } catch {
      continue;
    }
  }
  return best ? best.toISOString() : null;
}

function nextDcaDateIso(dayOfMonth: number, from: Date = new Date()): string {
  const cap = Math.min(Math.max(1, Math.trunc(dayOfMonth)), 28);
  const now = from.getTime();
  const lastOfMonth = (yy: number, mm: number) => new Date(yy, mm + 1, 0).getDate();
  let yy = from.getFullYear();
  let mm = from.getMonth();
  let d = Math.min(cap, lastOfMonth(yy, mm));
  let candidate = new Date(yy, mm, d, 12, 0, 0, 0);
  if (candidate.getTime() <= now) {
    mm += 1;
    if (mm > 11) {
      mm = 0;
      yy += 1;
    }
    d = Math.min(cap, lastOfMonth(yy, mm));
    candidate = new Date(yy, mm, d, 12, 0, 0, 0);
  }
  return candidate.toISOString();
}

async function loadPatrimoineSnapshotCore(
  organizationId: string,
  userSettings: PatrimoineUserSettings
): Promise<Omit<PatrimoineSnapshotResult, 'loading' | 'error'>> {
  const propRepo = getPropertyRepositoryOffline();
  const loanRepo = getLoanRepositoryOffline();
  const db = await getLocalDB();

  const [properties, loans] = await Promise.all([
    propRepo.getAll(organizationId, {}),
    loanRepo.getAll(organizationId, {}),
  ]);

  const immobilierBrut = properties.reduce((sum, p) => sum + (p.currentValue ?? p.acquisitionPrice ?? 0), 0);

  const toMonthStr = monthKeyNow();
  let dette = 0;
  for (const loan of loans.filter((l) => l.isActive)) {
    try {
      const schedule = buildSchedule({
        principal: Number(loan.principal),
        annualRatePct: Number(loan.annualRatePct),
        durationMonths: loan.durationMonths,
        defermentMonths: loan.defermentMonths || 0,
        insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
        startDate: new Date(loan.startDate),
        paymentDay: loan.paymentDay || undefined,
      });
      dette += crdAtDate(schedule, toMonthStr);
    } catch {
      // skip
    }
  }

  const immobilierNet = Math.max(0, immobilierBrut - dette);

  const fiscalRows = await db.FiscalSimulation.where('organizationId').equals(organizationId).toArray();
  const availableFiscalSimulations = buildAvailableFiscalSimulations(fiscalRows);
  const resolved = resolveFiscalSimulationForPatrimoine(fiscalRows, userSettings.selectedFiscalSimulationId ?? null);
  const fiscalRow = resolved.fiscalRow;
  const fiscalSimulationSelectionMode = resolved.mode;
  const fiscalSimulationWarning = resolved.fiscalSimulationWarning;
  const fiscalResult = fiscalRow ? parseSimulationResult(fiscalRow) : null;
  const hasFiscalSimulation = fiscalResult != null;
  const fiscalInputs = fiscalRow ? parseFiscalInputs(fiscalRow) : null;

  const rawRevenuLoc =
    fiscalResult?.resume?.beneficeNetImmobilier != null && Number.isFinite(fiscalResult.resume.beneficeNetImmobilier)
      ? fiscalResult.resume.beneficeNetImmobilier
      : fiscalResult?.cashflow?.cashflowNet != null && Number.isFinite(fiscalResult.cashflow.cashflowNet)
        ? fiscalResult.cashflow.cashflowNet
        : 0;
  const revenuLocatifNet = Number.isFinite(rawRevenuLoc) && rawRevenuLoc >= 0 ? rawRevenuLoc : 0;

  let fiscalResteAPayer: number | null = null;
  let fiscalMonthsRemaining: number | null = null;
  let effortFiscalMensuel: number | null = null;
  let nextTaxIso: string | null = null;

  if (fiscalResult && fiscalRow) {
    const totalImpots =
      fiscalResult.resume?.totalImpots ??
      (Number(fiscalResult.ir?.impotNet ?? 0) + Number(fiscalResult.ps?.montant ?? 0));
    const paid =
      Number(fiscalInputs?.options?.acomptesDejaPayes ?? 0) +
      Number(fiscalInputs?.options?.prelevementSourceDejaPaye ?? 0);
    fiscalResteAPayer = Math.max(0, Math.round((totalImpots - paid) * 100) / 100);
    const now = new Date();
    const { date: taxDate, monthsRemaining } = nextSeptemberDeadline(fiscalRow.year, now);
    fiscalMonthsRemaining = monthsRemaining;
    if (fiscalResteAPayer > 0 && fiscalMonthsRemaining > 0) {
      effortFiscalMensuel = Math.round((fiscalResteAPayer / fiscalMonthsRemaining) * 100) / 100;
    }
    nextTaxIso = taxDate.toISOString();
  }

  const availableInvestmentRows = await marketInvestmentStorage.listAllInvestmentProfilesNormalized(organizationId);
  const marketResolved = resolvePatrimoineMarketInvestment(
    availableInvestmentRows,
    userSettings.selectedMarketInvestmentId ?? null
  );
  const marketInvestmentSelectionMode = marketResolved.mode;
  const marketSelectionWarning = marketResolved.warning;
  const availableMarketInvestments = buildAvailableMarketInvestmentsForPatrimoine(marketResolved.availableInvestments);
  const marketSettings = marketResolved.selectedInvestment;

  let marketSnap: MarketSnapshot | null = null;
  let history: InvestmentActionLog[] = [];
  let marketRecommendation: InvestmentRecommendation | null = null;
  if (marketSettings) {
    const sym = normalizeMarketStorageSymbol(marketSettings.referenceSymbol);
    marketSnap = await marketInvestmentStorage.getSnapshot(organizationId, sym, marketSettings.athPeriod);
    history = await marketInvestmentStorage.listActionLogs(organizationId, 48);
    if (marketSnap) {
      marketRecommendation = computeInvestmentRecommendation(marketSettings, marketSnap, history);
    }
  }

  const hasMarketProfile = marketSettings != null;
  const cashFromPatrimoine = Math.max(0, userSettings.cashDisponible);
  const cashFromMarket = marketSettings ? Math.max(0, marketSettings.availableCash ?? 0) : 0;
  const sourceCash: PatrimoineAmountSource = hasMarketProfile ? 'MARKET' : 'PATRIMOINE';
  const cashDisponible = hasMarketProfile ? cashFromMarket : cashFromPatrimoine;
  const cashSecurite = Math.max(0, userSettings.cashSecurite);

  const peaEtfValue = Math.max(0, userSettings.peaEtfValue);

  const rendementEtfAnnuel = DEFAULT_ETF_ANNUAL_YIELD;
  const revenuEtfEstime = peaEtfValue * rendementEtfAnnuel;

  const patrimoineNetGlobal = immobilierNet + peaEtfValue + cashDisponible;
  const revenuGlobalEstime = revenuLocatifNet + revenuEtfEstime;

  const totalAlloc = patrimoineNetGlobal > 0 ? patrimoineNetGlobal : 1;
  const allocationEtf = patrimoineNetGlobal > 0 ? peaEtfValue / totalAlloc : 0;
  const allocationImmo = patrimoineNetGlobal > 0 ? immobilierNet / totalAlloc : 0;
  const scoreAllocation = computeAllocationScore(allocationEtf);

  const cashExcess = Math.max(0, cashDisponible - cashSecurite);
  const investableCash = cashExcess;

  const marketDcaBase =
    marketSettings && Number.isFinite(marketSettings.monthlyDcaAmount) ? Math.max(0, marketSettings.monthlyDcaAmount) : 0;
  const dcaFromMarketEngine = marketRecommendation
    ? marketRecommendation.monthlyDcaPortion
    : hasMarketProfile
      ? marketDcaBase
      : 0;
  const sourceDca: PatrimoineAmountSource = hasMarketProfile ? 'MARKET' : 'PATRIMOINE';
  const reinforceRecommended = marketRecommendation ? marketRecommendation.reinforcePortion : 0;

  const reserveCashMoteur =
    marketSettings != null
      ? (() => {
          const cashRef = Math.max(0, marketSettings.cashReferenceAmount || cashDisponible || 1);
          const reservePct = resolveMinCashReservePercent(marketSettings);
          const raw = cashRef * (reservePct / 100);
          return Number.isFinite(raw) ? raw : 0;
        })()
      : 0;

  const rawDd = marketSnap?.drawdownPercent;
  const drawdownPercent =
    rawDd != null && Number.isFinite(rawDd) ? rawDd : null;
  const athDistancePercent = computeAthDistancePercent(marketSnap);

  const rec = marketRecommendation;
  const marketScore = rec?.score ?? null;
  const marketScoreLabel = rec?.marketScoreLabel ?? null;
  const marketStatus = rec?.status ?? null;

  const decisionFlags: PatrimoineDecisionFlags = {
    isMarketHigh: marketScoreLabel === 'MARCHÉ HAUT' || (marketScore != null && marketScore > 70),
    isMarketOpportunity:
      marketStatus === 'OPPORTUNITE' ||
      marketStatus === 'FORTE_OPPORTUNITE' ||
      marketScoreLabel === 'OPPORTUNITÉ',
    hasTooMuchCash: cashExcess > 5000,
    isImmoHeavy: allocationImmo > 0.65,
  };

  const objective = userSettings.objective;

  const decisionInput = buildPatrimoineDecisionInput({
    marketRecommendation,
    drawdownPercent,
    athDistancePercent,
    scoreAllocation,
    allocationEtf,
    allocationImmo,
    cashExcess,
    investableCash,
    patrimoineNetGlobal,
    marketMonthlyDcaPortion: marketRecommendation?.monthlyDcaPortion ?? marketSettings?.monthlyDcaAmount ?? 0,
    marketReinforcePortion: marketRecommendation?.reinforcePortion ?? 0,
    marketSuggestedTotal: marketRecommendation?.suggestedAmount ?? 0,
    objective,
  });

  const patrimoineReco = computePatrimoineRecommendation(decisionInput);

  const dcaRecommended = hasMarketProfile ? dcaFromMarketEngine : patrimoineReco.dcaAmount;

  const monthlyCapacity = Math.round((revenuLocatifNet / 12) * 100) / 100;
  const monthlyCapacitySafe = Number.isFinite(monthlyCapacity) ? Math.max(0, monthlyCapacity) : 0;
  const effort = effortFiscalMensuel ?? 0;
  const netMonthlyFreeCash = Math.round((monthlyCapacitySafe - effort) * 100) / 100;

  const marketDayRaw = marketSettings?.monthlyInvestmentDay;
  const hasMarketDcaDay =
    typeof marketDayRaw === 'number' &&
    Number.isFinite(marketDayRaw) &&
    marketDayRaw >= 1 &&
    marketDayRaw <= 31;
  const sourceDcaDay: PatrimoineAmountSource = hasMarketProfile && hasMarketDcaDay ? 'MARKET' : 'PATRIMOINE';
  const effectiveDcaDayOfMonth = Math.min(
    31,
    Math.max(
      1,
      hasMarketDcaDay ? Math.trunc(marketDayRaw!) : userSettings.dcaDayOfMonth || 5
    )
  );
  const nextDcaDate = nextDcaDateIso(effectiveDcaDayOfMonth, new Date());
  const nextLoanPayment = computeNextLoanPaymentIso(loans);

  const priorityActions = computePriorityActions({
    objective,
    dcaMonthlyAmount: patrimoineReco.dcaAmount,
    reinforceSuggested: patrimoineReco.reinforceAmount > 0 ? patrimoineReco.reinforceAmount : reinforceRecommended,
    drawdownPercent,
    investableCash,
    fiscalResteAPayer,
    fiscalEffortMensuel: effortFiscalMensuel,
    cashExcess,
    cashSecurite,
  });

  const blendedAnnualYield = Math.min(0.12, Math.max(0.01, allocationEtf * rendementEtfAnnuel + 0.015));
  const projection5y = computeCashflowProjection(
    {
      initialCash: cashDisponible,
      initialPatrimoine: patrimoineNetGlobal,
      monthlyCapacity: monthlyCapacitySafe,
      monthlyFiscalEffort: effortFiscalMensuel ?? 0,
      monthlyDca: patrimoineReco.dcaAmount,
      annualPatrimoineYield: blendedAnnualYield,
    },
    5
  );
  const hasMarketData = marketSnap != null;

  const marketProfileSummary = marketSettings ? formatPatrimoineMarketProfileLabel(marketSettings) : null;

  return {
    immobilierBrut,
    dette,
    immobilierNet,
    revenuLocatifNet,
    peaEtfValue,
    cashDisponible,
    cashSecurite,
    patrimoineNetGlobal,
    revenuGlobalEstime,
    marketRecommendation,
    dcaRecommended,
    reinforceRecommended,
    rendementEtfAnnuel,
    reserveCashMoteur,
    drawdownPercent,
    athDistancePercent,
    scoreAllocation,
    allocationEtf,
    allocationImmo,
    cashExcess,
    investableCash,
    decisionFlags,
    marketScore,
    marketScoreLabel,
    marketStatus,
    fiscalSimulationId: fiscalRow?.id ?? null,
    fiscalYear: fiscalRow?.year ?? null,
    hasFiscalSimulation,
    patrimoineReco,
    monthlyCapacity: monthlyCapacitySafe,
    effortFiscalMensuel,
    netMonthlyFreeCash,
    fiscalResteAPayer,
    fiscalMonthsRemaining,
    nextEvents: {
      nextTaxPayment: hasFiscalSimulation ? nextTaxIso : null,
      nextDcaDate,
      nextLoanPayment,
    },
    priorityActions,
    userObjective: objective,
    effectiveDcaDayOfMonth,
    hasMarketData,
    projectionTrend: projection5y.trend,
    projectionPatrimoineDeltaRatio: projection5y.patrimoineDeltaRatio,
    selectedFiscalSimulationId: fiscalRow?.id ?? null,
    fiscalSimulationSelectionMode,
    availableFiscalSimulations,
    fiscalSimulationWarning,
    selectedMarketInvestmentId: marketSettings?.id ?? null,
    marketInvestmentSelectionMode,
    availableMarketInvestments,
    marketSelectionWarning,
    sourceCash,
    sourceDca,
    sourceDcaDay,
    marketProfileSummary,
  };
}

export interface UsePatrimoineSnapshotOptions {
  organizationId: string | undefined;
  userSettings: PatrimoineUserSettings;
}

function emptyReco(): PatrimoineRecommendationResult {
  return {
    primaryAction: 'WAIT',
    dcaAmount: 0,
    reinforceAmount: 0,
    message: 'Charge les données pour obtenir une recommandation.',
    level: 'INFO',
  };
}

export function usePatrimoineSnapshot(options: UsePatrimoineSnapshotOptions): PatrimoineSnapshotResult {
  const { organizationId, userSettings } = options;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [core, setCore] = useState<Omit<PatrimoineSnapshotResult, 'loading' | 'error'> | null>(null);

  const cashDisponible = userSettings.cashDisponible;
  const cashSecurite = userSettings.cashSecurite;
  const peaEtfValueSetting = userSettings.peaEtfValue;
  const dcaDayOfMonth = userSettings.dcaDayOfMonth;
  const objective = userSettings.objective;
  const selectedFiscalSimulationIdPref = userSettings.selectedFiscalSimulationId ?? null;
  const selectedMarketInvestmentIdPref = userSettings.selectedMarketInvestmentId ?? null;

  const reload = useCallback(async () => {
    if (!organizationId) {
      setCore(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const settingsSlice: PatrimoineUserSettings = {
        cashDisponible,
        cashSecurite,
        peaEtfValue: peaEtfValueSetting,
        dcaDayOfMonth,
        objective,
        selectedFiscalSimulationId: selectedFiscalSimulationIdPref,
        selectedMarketInvestmentId: selectedMarketInvestmentIdPref,
      };
      const data = await loadPatrimoineSnapshotCore(organizationId, settingsSlice);
      setCore(data);
    } catch (e) {
      console.error('[usePatrimoineSnapshot]', e);
      setError('Impossible de charger le snapshot patrimoine.');
      setCore(null);
    } finally {
      setLoading(false);
    }
  }, [
    organizationId,
    cashDisponible,
    cashSecurite,
    peaEtfValueSetting,
    dcaDayOfMonth,
    objective,
    selectedFiscalSimulationIdPref,
    selectedMarketInvestmentIdPref,
  ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onSync = () => {
      void reload();
    };
    window.addEventListener('sync:refresh', onSync);
    window.addEventListener('patrimoine:refresh', onSync);
    return () => {
      window.removeEventListener('sync:refresh', onSync);
      window.removeEventListener('patrimoine:refresh', onSync);
    };
  }, [reload]);

  const emptySnapshot = useMemo(
    (): PatrimoineSnapshotResult => ({
      immobilierBrut: 0,
      dette: 0,
      immobilierNet: 0,
      revenuLocatifNet: 0,
      peaEtfValue: 0,
      cashDisponible: 0,
      cashSecurite: userSettings.cashSecurite,
      patrimoineNetGlobal: 0,
      revenuGlobalEstime: 0,
      marketRecommendation: null,
      dcaRecommended: 0,
      reinforceRecommended: 0,
      rendementEtfAnnuel: DEFAULT_ETF_ANNUAL_YIELD,
      reserveCashMoteur: 0,
      drawdownPercent: null,
      athDistancePercent: null,
      scoreAllocation: 0,
      allocationEtf: 0,
      allocationImmo: 0,
      cashExcess: 0,
      investableCash: 0,
      decisionFlags: {
        isMarketHigh: false,
        isMarketOpportunity: false,
        hasTooMuchCash: false,
        isImmoHeavy: false,
      },
      marketScore: null,
      marketScoreLabel: null,
      marketStatus: null,
      fiscalSimulationId: null,
      fiscalYear: null,
      hasFiscalSimulation: false,
      patrimoineReco: emptyReco(),
      monthlyCapacity: 0,
      effortFiscalMensuel: null,
      netMonthlyFreeCash: 0,
      fiscalResteAPayer: null,
      fiscalMonthsRemaining: null,
      nextEvents: {
        nextTaxPayment: null,
        nextDcaDate: null,
        nextLoanPayment: null,
      },
      priorityActions: [],
      userObjective: userSettings.objective,
      effectiveDcaDayOfMonth: userSettings.dcaDayOfMonth,
      hasMarketData: false,
      projectionTrend: 'stagnation',
      projectionPatrimoineDeltaRatio: 0,
      selectedFiscalSimulationId: null,
      fiscalSimulationSelectionMode: 'AUTO',
      availableFiscalSimulations: [],
      fiscalSimulationWarning: null,
      selectedMarketInvestmentId: null,
      marketInvestmentSelectionMode: 'AUTO',
      availableMarketInvestments: [],
      marketSelectionWarning: null,
      sourceCash: 'PATRIMOINE',
      sourceDca: 'PATRIMOINE',
      sourceDcaDay: 'PATRIMOINE',
      marketProfileSummary: null,
      loading,
      error,
    }),
    [
      loading,
      error,
      userSettings.cashSecurite,
      userSettings.objective,
      userSettings.dcaDayOfMonth,
    ]
  );

  return useMemo(() => (core ? { ...core, loading, error } : emptySnapshot), [core, loading, error, emptySnapshot]);
}
