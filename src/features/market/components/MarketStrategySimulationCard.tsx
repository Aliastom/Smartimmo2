'use client';

import { useEffect, useMemo, useState } from 'react';
import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { InvestmentSettings, MarketSnapshot } from '@/features/market/types';
import { TrendingUp } from 'lucide-react';

function safeFormatCurrency(value: number, currency: string): string | null {
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function formatMoney(value: number, currency: string): string {
  return safeFormatCurrency(value, currency) ?? '—';
}

function formatSignedMoney(value: number, currency: string): string {
  const abs = safeFormatCurrency(Math.abs(value), currency) ?? '—';
  return `${value >= 0 ? '+' : '-'}${abs}`;
}

function formatSignedPercent(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${Math.abs(value).toFixed(1).replace('.', ',')}% / an`;
}

function gainTone(value: number): string {
  return value >= 0 ? 'text-emerald-500' : 'text-rose-500';
}

/**
 * Rendement annualisé net simplifié (approximation lisible utilisateur).
 * Base: valeur finale nette vs total investi sur l'horizon.
 */
function annualizedReturnApprox(finalValue: number, investedAmount: number, years: number): number | null {
  if (!Number.isFinite(finalValue) || !Number.isFinite(investedAmount) || !Number.isFinite(years)) return null;
  if (investedAmount <= 0 || years <= 0 || finalValue <= 0) return null;
  const ratio = finalValue / investedAmount;
  if (ratio <= 0) return null;
  return (ratio ** (1 / years) - 1) * 100;
}

interface ProjectionScenario {
  id: 'pessimiste' | 'normal' | 'optimiste';
  label: string;
  baseRate: number;
}

interface ProjectionRow {
  horizon: number;
  grossLump: number;
  netLump: number;
  grossDca: number;
  netDca: number;
}

interface ProjectionCard {
  id: ProjectionScenario['id'];
  label: string;
  baseRatePct: number;
  adjustedRatePct: number;
  rows: ProjectionRow[];
}

type ProjectionMode = 'dca' | 'lump' | 'mix';
type InvestorProfileId = 'prudent' | 'equilibre' | 'offensif';

interface InvestorProfile {
  id: InvestorProfileId;
  label: string;
  immediateShare: number;
  dcaShare: number;
}

const SCENARIOS: ProjectionScenario[] = [
  { id: 'pessimiste', label: 'Pessimiste', baseRate: 0.04 },
  { id: 'normal', label: 'Normal', baseRate: 0.07 },
  { id: 'optimiste', label: 'Optimiste', baseRate: 0.1 },
];

const HORIZONS = [5, 10, 15];
const CHART_HORIZON_YEARS = 15;
const FREE_SIM_LUMP_MAX = 200_000;

const INVESTOR_PROFILES: InvestorProfile[] = [
  { id: 'prudent', label: 'Prudent', immediateShare: 0.3, dcaShare: 0.7 },
  { id: 'equilibre', label: 'Équilibré', immediateShare: 0.6, dcaShare: 0.4 },
  { id: 'offensif', label: 'Offensif', immediateShare: 0.8, dcaShare: 0.2 },
];

/** Taux par défaut si absent des paramètres (17,2 %). */
const DEFAULT_PEA_SOCIAL_ON_GAINS = 0.172;

function resolvePeaSocialOnGainsRate(settings: Pick<InvestmentSettings, 'peaSocialContributionsOnGainsRate'>): number {
  const r = settings.peaSocialContributionsOnGainsRate;
  if (typeof r === 'number' && Number.isFinite(r) && r >= 0 && r <= 1) return r;
  return DEFAULT_PEA_SOCIAL_ON_GAINS;
}

/** Taux décimal (ex. 0,172) → libellé pourcentage FR « 17,2 » (jamais NaN / undefined). */
function formatPercentFromDecimal(decimalRate: number): string {
  const d = Number.isFinite(decimalRate) ? decimalRate : DEFAULT_PEA_SOCIAL_ON_GAINS;
  const clamped = Math.min(1, Math.max(0, d));
  return (clamped * 100).toFixed(1).replace('.', ',');
}

function drawdownRateAdjustment(drawdownPercent: number | null): number {
  if (drawdownPercent == null || !Number.isFinite(drawdownPercent)) return 0;
  if (drawdownPercent <= -20) return 0.015;
  if (drawdownPercent <= -10) return 0.01;
  if (drawdownPercent <= -5) return 0.005;
  if (drawdownPercent >= 0) return -0.005;
  return 0;
}

function clampRate(rate: number): number {
  return Math.min(0.14, Math.max(0.01, rate));
}

function compoundedValue(amount: number, annualRate: number, years: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return amount * (1 + annualRate) ** years;
}

function dcaFutureValue(monthlyAmount: number, annualRate: number, years: number): number {
  if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) return 0;
  const months = years * 12;
  const monthlyRate = (1 + annualRate) ** (1 / 12) - 1;
  if (!Number.isFinite(monthlyRate) || Math.abs(monthlyRate) < 1e-9) return monthlyAmount * months;
  return monthlyAmount * (((1 + monthlyRate) ** months - 1) / monthlyRate);
}

function investedDcaAmount(monthlyAmount: number, years: number): number {
  return Math.max(0, monthlyAmount) * years * 12;
}

/**
 * Taux appliqué uniquement sur les gains (valeur − capital investi), enveloppe simplifiée.
 * PEA : avant 5 ans (horizon de projection inférieur à 5) flat 30 % ; à partir de 5 ans, uniquement prélèvements sociaux sur les gains.
 */
function applicableGainsTaxRate(
  envelope: InvestmentSettings['envelope'],
  horizonYears: number,
  peaSocialOnGainsAfterFiveYears: number
): number {
  if (envelope === 'PEA') {
    if (horizonYears >= 5) return peaSocialOnGainsAfterFiveYears;
    return 0.3;
  }
  if (envelope === 'CTO') return 0.3;
  return 0.3;
}

function netAfterTax(grossValue: number, investedAmount: number, taxRate: number): number {
  const gains = Math.max(0, grossValue - investedAmount);
  return grossValue - (gains * taxRate);
}

interface MarketStrategySimulationCardProps {
  settings: InvestmentSettings;
  snapshot?: MarketSnapshot | null;
}

export function MarketStrategySimulationCard({ settings, snapshot = null }: MarketStrategySimulationCardProps) {
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>('dca');
  const [selectedScenarioId, setSelectedScenarioId] = useState<ProjectionScenario['id']>('normal');
  const [selectedProfileId, setSelectedProfileId] = useState<InvestorProfileId>('equilibre');
  const [simulatedMonthlyDca, setSimulatedMonthlyDca] = useState(() => {
    const rounded = Math.round(settings.monthlyDcaAmount / 50) * 50;
    return Math.min(2000, Math.max(100, rounded || 100));
  });
  const [simulatedLumpSum, setSimulatedLumpSum] = useState(() => {
    const rounded = Math.round(settings.availableCash / 100) * 100;
    return Math.max(0, rounded);
  });
  const [simulatedLumpInput, setSimulatedLumpInput] = useState(() => String(Math.max(0, Math.round(settings.availableCash / 100) * 100)));
  const [resetNotice, setResetNotice] = useState<string | null>(null);
  const [lumpClampNotice, setLumpClampNotice] = useState<string | null>(null);
  const [useRealCashBounds, setUseRealCashBounds] = useState(false);

  useEffect(() => {
    const rounded = Math.round(settings.monthlyDcaAmount / 50) * 50;
    setSimulatedMonthlyDca(Math.min(2000, Math.max(100, rounded || 100)));
  }, [settings.monthlyDcaAmount]);
  useEffect(() => {
    const rounded = Math.round(settings.availableCash / 100) * 100;
    setSimulatedLumpSum(Math.max(0, rounded));
    setSimulatedLumpInput(String(Math.max(0, rounded)));
  }, [settings.availableCash]);
  const [resultPulse, setResultPulse] = useState(false);

  const annualRateShift = useMemo(
    () => drawdownRateAdjustment(snapshot?.drawdownPercent ?? null),
    [snapshot?.drawdownPercent]
  );

  const peaSocialOnGainsRate = useMemo(() => resolvePeaSocialOnGainsRate(settings), [settings.peaSocialContributionsOnGainsRate]);

  const taxLegend = useMemo(() => {
    const psPct = formatPercentFromDecimal(peaSocialOnGainsRate);
    if (settings.envelope === 'PEA') {
      return `Fiscalité PEA : après 5 ans, exonération d’impôt sur le revenu, prélèvements sociaux appliqués sur les gains. Taux prélèvements sociaux sur les gains : ${psPct}\u00a0%.`;
    }
    if (settings.envelope === 'CTO') return 'Fiscalité CTO : flat tax 30 %';
    return 'Fiscalité : flat tax 30 %';
  }, [settings.envelope, peaSocialOnGainsRate]);

  const netFiscalHelpTitle = useMemo(() => {
    if (settings.envelope === 'PEA') {
      const p = formatPercentFromDecimal(peaSocialOnGainsRate);
      return `Net après prélèvements sociaux (${p} %) appliqués uniquement sur les gains.`;
    }
    return 'Net après fiscalité simplifiée (30 % sur les gains).';
  }, [settings.envelope, peaSocialOnGainsRate]);

  const scenarioCards = useMemo<ProjectionCard[]>(
    () =>
      SCENARIOS.map((scenario) => {
        const adjustedRate = clampRate(scenario.baseRate + annualRateShift);
        const rows = HORIZONS.map((horizon) => {
          const grossLump = compoundedValue(simulatedLumpSum, adjustedRate, horizon);
          const grossDca = dcaFutureValue(simulatedMonthlyDca, adjustedRate, horizon);
          const taxRate = applicableGainsTaxRate(settings.envelope, horizon, peaSocialOnGainsRate);
          const netLump = netAfterTax(grossLump, simulatedLumpSum, taxRate);
          const netDca = netAfterTax(grossDca, investedDcaAmount(simulatedMonthlyDca, horizon), taxRate);
          return { horizon, grossLump, netLump, grossDca, netDca };
        });
        return {
          id: scenario.id,
          label: scenario.label,
          baseRatePct: scenario.baseRate * 100,
          adjustedRatePct: adjustedRate * 100,
          rows,
        };
      }),
    [annualRateShift, peaSocialOnGainsRate, settings.envelope, simulatedLumpSum, simulatedMonthlyDca]
  );
  const selectedScenario = scenarioCards.find((scenario) => scenario.id === selectedScenarioId) ?? scenarioCards[0] ?? null;
  const selectedScenarioBaseRatePct = selectedScenario?.baseRatePct ?? 0;
  const simulatedLumpMax = useRealCashBounds ? Math.max(0, settings.availableCash) : FREE_SIM_LUMP_MAX;
  const normalizeLumpSum = (value: number): number => {
    if (!Number.isFinite(value)) return 0;
    const rounded = Math.round(value / 100) * 100;
    return Math.min(simulatedLumpMax, Math.max(0, rounded));
  };
  const applyLumpSum = (rawValue: number, source: 'slider' | 'input') => {
    const capped = Number.isFinite(rawValue) && rawValue > simulatedLumpMax;
    const normalized = normalizeLumpSum(rawValue);
    setSimulatedLumpSum(normalized);
    setSimulatedLumpInput(String(normalized));
    if (source === 'input' && capped) {
      setLumpClampNotice('Montant limité au cash disponible simulable.');
      return;
    }
    setLumpClampNotice(null);
  };
  const commitLumpInput = () => {
    const raw = Number(simulatedLumpInput);
    applyLumpSum(Number.isFinite(raw) ? raw : simulatedLumpSum, 'input');
  };
  const selectedScenarioRate = selectedScenario ? selectedScenario.adjustedRatePct / 100 : null;
  const selectedProfile = INVESTOR_PROFILES.find((profile) => profile.id === selectedProfileId) ?? INVESTOR_PROFILES[1];
  const interactiveRows = useMemo(() => {
    if (selectedScenarioRate == null) return [];
    return HORIZONS.map((horizon) => {
      const grossLump = compoundedValue(simulatedLumpSum, selectedScenarioRate, horizon);
      const taxRate = applicableGainsTaxRate(settings.envelope, horizon, peaSocialOnGainsRate);
      const netLump = netAfterTax(grossLump, simulatedLumpSum, taxRate);
      const grossDca = dcaFutureValue(simulatedMonthlyDca, selectedScenarioRate, horizon);
      const netDca = netAfterTax(grossDca, investedDcaAmount(simulatedMonthlyDca, horizon), taxRate);
      return { horizon, netLump, netDca };
    });
  }, [peaSocialOnGainsRate, selectedScenarioRate, settings.envelope, simulatedLumpSum, simulatedMonthlyDca]);
  const selected10y = interactiveRows.find((row) => row.horizon === 10) ?? null;
  const selected10yInvestedDca = selected10y ? investedDcaAmount(simulatedMonthlyDca, 10) : 0;
  const selected10yInvestedLump = simulatedLumpSum;
  const selected10yInvestedTotal = selected10yInvestedDca + selected10yInvestedLump;
  const selected10yDcaGain = selected10y ? selected10y.netDca - selected10yInvestedDca : 0;
  const selected10yLumpGain = selected10y ? selected10y.netLump - simulatedLumpSum : 0;
  const selected10yCombinedNet = selected10y ? selected10y.netDca + selected10y.netLump : null;
  const selected10yCombinedGain =
    selected10yCombinedNet != null ? selected10yCombinedNet - selected10yInvestedTotal : 0;
  const selected10yCombinedAnnualized =
    selected10yCombinedNet != null
      ? annualizedReturnApprox(selected10yCombinedNet, selected10yInvestedTotal, 10)
      : null;
  const mainNetValue = selected10y ? (projectionMode === 'dca' ? selected10y.netDca : selected10y.netLump) : null;
  const mainGain = projectionMode === 'dca' ? selected10yDcaGain : selected10yLumpGain;
  const mainAnnualized = selected10y
    ? projectionMode === 'dca'
      ? annualizedReturnApprox(selected10y.netDca, selected10yInvestedDca, 10)
      : annualizedReturnApprox(selected10y.netLump, simulatedLumpSum, 10)
    : null;
  const profileProjection = useMemo(() => {
    if (!selectedScenarioRate) return null;
    const horizon = 10;
    const immediateInvested = simulatedLumpSum * selectedProfile.immediateShare;
    const dcaInvestedTotal = simulatedLumpSum * selectedProfile.dcaShare;
    const profileMonthly = dcaInvestedTotal / (horizon * 12);
    const grossImmediate = compoundedValue(immediateInvested, selectedScenarioRate, horizon);
    const grossDca = dcaFutureValue(profileMonthly, selectedScenarioRate, horizon);
    const taxRate = applicableGainsTaxRate(settings.envelope, horizon, peaSocialOnGainsRate);
    const netImmediate = netAfterTax(grossImmediate, immediateInvested, taxRate);
    const netDca = netAfterTax(grossDca, dcaInvestedTotal, taxRate);
    const netTotal = netImmediate + netDca;
    return {
      netTotal,
      gain: netTotal - simulatedLumpSum,
      investedTotal: simulatedLumpSum,
      immediatePct: Math.round(selectedProfile.immediateShare * 100),
      dcaPct: Math.round(selectedProfile.dcaShare * 100),
      immediateInvested,
      dcaInvestedTotal,
    };
  }, [peaSocialOnGainsRate, selectedScenarioRate, selectedProfile, simulatedLumpSum, settings.envelope]);
  const profileComparisons = useMemo(() => {
    if (!selectedScenarioRate) return [];
    return INVESTOR_PROFILES.map((profile) => {
      const horizon = 10;
      const immediateInvested = simulatedLumpSum * profile.immediateShare;
      const dcaInvestedTotal = simulatedLumpSum * profile.dcaShare;
      const profileMonthly = dcaInvestedTotal / (horizon * 12);
      const grossImmediate = compoundedValue(immediateInvested, selectedScenarioRate, horizon);
      const grossDca = dcaFutureValue(profileMonthly, selectedScenarioRate, horizon);
      const taxRate = applicableGainsTaxRate(settings.envelope, horizon, peaSocialOnGainsRate);
      const netImmediate = netAfterTax(grossImmediate, immediateInvested, taxRate);
      const netDca = netAfterTax(grossDca, dcaInvestedTotal, taxRate);
      const netTotal = netImmediate + netDca;
      return {
        id: profile.id,
        label: profile.label,
        immediatePct: Math.round(profile.immediateShare * 100),
        dcaPct: Math.round(profile.dcaShare * 100),
        netTotal,
        gain: netTotal - simulatedLumpSum,
      };
    });
  }, [peaSocialOnGainsRate, selectedScenarioRate, settings.envelope, simulatedLumpSum]);
  const effectiveMainNetValue = projectionMode === 'mix' ? profileProjection?.netTotal ?? null : mainNetValue;
  const effectiveMainGain = projectionMode === 'mix' ? profileProjection?.gain ?? 0 : mainGain;
  const effectiveMainAnnualized =
    projectionMode === 'mix'
      ? profileProjection?.netTotal != null
        ? annualizedReturnApprox(profileProjection.netTotal, simulatedLumpSum, 10)
        : null
      : mainAnnualized;
  const profileMainReturnPct =
    profileProjection?.netTotal != null && profileProjection.investedTotal > 0
      ? (profileProjection.gain / profileProjection.investedTotal) * 100
      : null;
  const selectProfile = (profileId: InvestorProfileId) => {
    setSelectedProfileId(profileId);
    setProjectionMode('mix');
  };
  const chartData = useMemo(() => {
    if (selectedScenarioRate == null) return [];
    return Array.from({ length: CHART_HORIZON_YEARS + 1 }, (_, year) => {
      const projectedDca = dcaFutureValue(simulatedMonthlyDca, selectedScenarioRate, year);
      const investedDca = investedDcaAmount(simulatedMonthlyDca, year);
      const projectedLump = compoundedValue(simulatedLumpSum, selectedScenarioRate, year);
      const profileImmediateInvested = simulatedLumpSum * selectedProfile.immediateShare;
      const profileDcaInvestedTotal = simulatedLumpSum * selectedProfile.dcaShare;
      const profileMonthly = profileDcaInvestedTotal / (10 * 12);
      const profileContributionYears = Math.min(year, 10);
      const profileDcaCore = dcaFutureValue(profileMonthly, selectedScenarioRate, profileContributionYears);
      const profileDcaProjected =
        year > 10 ? profileDcaCore * (1 + selectedScenarioRate) ** (year - 10) : profileDcaCore;
      const projectedProfile =
        compoundedValue(profileImmediateInvested, selectedScenarioRate, year) + profileDcaProjected;
      const investedProfile =
        profileImmediateInvested + Math.min(profileDcaInvestedTotal, profileMonthly * profileContributionYears * 12);
      // Le graphe doit rester aligné avec la carte : portefeuille affiché en net fiscal.
      const taxRate = applicableGainsTaxRate(settings.envelope, year, peaSocialOnGainsRate);
      const projectedDcaNet = netAfterTax(projectedDca, investedDca, taxRate);
      const projectedLumpNet = netAfterTax(projectedLump, simulatedLumpSum, taxRate);
      const projectedProfileNet = netAfterTax(projectedProfile, investedProfile, taxRate);
      return {
        year,
        projected: projectionMode === 'dca' ? projectedDcaNet : projectionMode === 'lump' ? projectedLumpNet : projectedProfileNet,
        invested: projectionMode === 'dca' ? investedDca : projectionMode === 'lump' ? simulatedLumpSum : investedProfile,
        isFinal: year === CHART_HORIZON_YEARS,
      };
    });
  }, [peaSocialOnGainsRate, projectionMode, selectedProfile, selectedScenarioRate, settings.envelope, simulatedLumpSum, simulatedMonthlyDca]);
  /** Couleurs courbe / aire / tooltip — liées au scénario sélectionné (UI uniquement). */
  const scenarioChartVisual = useMemo(() => {
    switch (selectedScenarioId) {
      case 'pessimiste':
        return {
          stroke: '#64748f',
          fillTop: '#fb7185',
          fillTopOpacity: 0.2,
          fillBottom: '#64748b',
          fillBottomOpacity: 0.05,
          tooltipAccent: '#64748f',
          legendLine: 'ardoise (teinte rose sous la courbe)',
        };
      case 'normal':
        return {
          stroke: '#3b82f6',
          fillTop: '#3b82f6',
          fillTopOpacity: 0.18,
          fillBottom: '#3b82f6',
          fillBottomOpacity: 0.02,
          tooltipAccent: '#3b82f6',
          legendLine: 'bleue',
        };
      default:
        return {
          stroke: '#6366f1',
          fillTop: '#6366f1',
          fillTopOpacity: 0.18,
          fillBottom: '#6366f1',
          fillBottomOpacity: 0.02,
          tooltipAccent: '#6366f1',
          legendLine: 'violette (indigo)',
        };
    }
  }, [selectedScenarioId]);
  const chartFinalPoint = chartData[chartData.length - 1] ?? null;
  const isLumpLocallyModified = Math.round(simulatedLumpSum) !== Math.round(settings.availableCash);
  const isMixMode = projectionMode === 'mix';
  const resultSignature = `${projectionMode}:${selectedScenarioId}:${selectedProfileId}:${simulatedMonthlyDca}:${simulatedLumpSum}:${effectiveMainNetValue ?? 0}:${effectiveMainGain}:${effectiveMainAnnualized ?? 0}`;
  useEffect(() => {
    setResultPulse(true);
    const t = window.setTimeout(() => setResultPulse(false), 180);
    return () => window.clearTimeout(t);
  }, [resultSignature]);
  useEffect(() => {
    if (!resetNotice) return undefined;
    const t = window.setTimeout(() => setResetNotice(null), 2200);
    return () => window.clearTimeout(t);
  }, [resetNotice]);
  const handleResetSimulation = () => {
    const monthly = Math.min(2000, Math.max(100, Math.round(settings.monthlyDcaAmount / 50) * 50 || 100));
    const lump = Math.max(0, Math.round(settings.availableCash / 100) * 100);
    setSimulatedMonthlyDca(monthly);
    setSimulatedLumpSum(lump);
    setSimulatedLumpInput(String(lump));
    setLumpClampNotice(null);
    setSelectedScenarioId('normal');
    setSelectedProfileId('equilibre');
    setProjectionMode('dca');
    setUseRealCashBounds(true);
    setResetNotice('Simulation réinitialisée');
  };

  const emphasizeScenarioLumpCol = projectionMode === 'lump';
  const emphasizeScenarioDcaCol = projectionMode === 'dca';
  /** Colonne stratégie : repère vertical + fond léger (cellules) ; header sans fond plein. */
  const scenarioColHeaderLump = emphasizeScenarioLumpCol
    ? 'border-l border-indigo-200 pl-2.5 text-left font-medium text-indigo-600'
    : 'border-l border-transparent pl-2.5 text-left text-slate-600';
  const scenarioColHeaderDca = emphasizeScenarioDcaCol
    ? 'border-l border-indigo-200 pl-2.5 text-left font-medium text-indigo-600'
    : 'border-l border-transparent pl-2.5 text-left text-slate-600';
  const scenarioColCellLump = emphasizeScenarioLumpCol
    ? 'border-l border-indigo-200 bg-indigo-50/40 pl-2.5 transition-colors duration-200'
    : 'border-l border-transparent pl-2.5 transition-colors duration-200';
  const scenarioColCellDca = emphasizeScenarioDcaCol
    ? 'border-l border-indigo-200 bg-indigo-50/40 pl-2.5 transition-colors duration-200'
    : 'border-l border-transparent pl-2.5 transition-colors duration-200';

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
      <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-slate-600">
        <TrendingUp className="h-3.5 w-3.5 text-violet-600" aria-hidden />
        📊 Simulation d’investissement (simple)
      </p>
      <p className="text-[11px] leading-snug text-slate-500">
        Hypothèses globales 4% / 7% / 10%, ajustées selon drawdown actuel ({snapshot?.drawdownPercent?.toFixed(2) ?? 'n/a'} %).
      </p>
      <div className="mt-1 text-[11px] leading-snug text-slate-600">
        <p>Simulation basée sur votre cash et DCA :</p>
        <ul className="mt-0.5 space-y-0.5">
          <li>• 💰 En une fois ({formatMoney(settings.availableCash, settings.currency)})</li>
          <li>• 📅 Chaque mois ({formatMoney(settings.monthlyDcaAmount, settings.currency)})</li>
        </ul>
        <p className="mt-0.5 text-slate-500">Estimations indicatives.</p>
      </div>
      <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-500">Stratégie d’investissement</span>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-[11px] font-medium ${
              projectionMode === 'dca' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
            }`}
            onClick={() => setProjectionMode('dca')}
          >
            DCA (100% progressif)
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-[11px] font-medium ${
              projectionMode === 'lump' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
            }`}
            onClick={() => setProjectionMode('lump')}
          >
            Immédiat (100%)
          </button>
          <button
            type="button"
            className={`rounded-md px-2 py-1 text-[11px] font-medium ${
              projectionMode === 'mix' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
            }`}
            onClick={() => setProjectionMode('mix')}
          >
            Mix (profil)
          </button>
          <span className="ml-2 text-[11px] text-slate-500">Scénario</span>
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                selectedScenarioId === scenario.id ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
              }`}
              onClick={() => setSelectedScenarioId(scenario.id)}
            >
              {scenario.label}
            </button>
          ))}
          <button
            type="button"
            className="ml-auto rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
            onClick={handleResetSimulation}
          >
            Réinitialiser
          </button>
        </div>
        <div className="mb-2">
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Montant mensuel : {formatMoney(simulatedMonthlyDca, settings.currency)}</span>
            <span>100 € – 2 000 €</span>
          </div>
          <input
            type="range"
            min={100}
            max={2000}
            step={50}
            value={simulatedMonthlyDca}
            onChange={(e) => setSimulatedMonthlyDca(Number(e.target.value))}
            className="mt-1 h-1.5 w-full cursor-pointer accent-indigo-500"
          />
          <p className="mt-1 text-[10px] text-slate-500">Simulation locale — n’impacte pas vos paramètres.</p>
        </div>
        <div className="mb-2">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                useRealCashBounds ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
              }`}
              onClick={() => {
                setUseRealCashBounds(true);
                const clamped = Math.min(Math.max(0, Math.round(simulatedLumpSum / 100) * 100), Math.max(0, settings.availableCash));
                setSimulatedLumpSum(clamped);
                setSimulatedLumpInput(String(clamped));
              }}
            >
              Utiliser mon cash réel
            </button>
            <button
              type="button"
              className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                !useRealCashBounds ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
              }`}
              onClick={() => setUseRealCashBounds(false)}
            >
              Simulation libre
            </button>
            <span className="text-[10px] text-slate-500">Cash réel : {formatMoney(settings.availableCash, settings.currency)} (lecture seule)</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span>Investissement ponctuel : {formatMoney(simulatedLumpSum, settings.currency)}</span>
            <span>0 € – {formatMoney(simulatedLumpMax, settings.currency)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={simulatedLumpMax}
            step={100}
            value={simulatedLumpSum}
            onChange={(e) => applyLumpSum(Number(e.target.value), 'slider')}
            className="mt-1 h-1.5 w-full cursor-pointer accent-indigo-500"
          />
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={simulatedLumpMax}
              step={100}
              value={simulatedLumpInput}
              onChange={(e) => {
                setSimulatedLumpInput(e.target.value);
                setLumpClampNotice(null);
              }}
              onBlur={commitLumpInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitLumpInput();
                }
              }}
              className="h-7 w-28 rounded-md border border-slate-300 px-2 text-xs text-slate-700"
            />
            {isLumpLocallyModified && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                modifié localement
              </span>
            )}
          </div>
          {lumpClampNotice && <p className="mt-1 text-[10px] text-amber-700">{lumpClampNotice}</p>}
          <p className="mt-1 text-[10px] text-slate-500">
            {useRealCashBounds
              ? 'Simulation locale bornée par votre cash réel — n’impacte pas vos données.'
              : 'Simulation libre — n’impacte pas votre cash réel.'}
          </p>
        </div>
        {isMixMode && (
          <div className="mb-2">
            <p className="mb-0.5 text-[11px] text-slate-500">Comparer les profils</p>
            <p className="mb-1 text-[10px] text-slate-500">
              Comparatif à 10 ans — scénario {selectedScenario?.label ?? 'Normal'} ({selectedScenarioBaseRatePct.toFixed(0)}%)
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {profileComparisons.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => selectProfile(profile.id)}
                  className={`rounded-lg border px-2 py-1.5 text-left ${
                    selectedProfileId === profile.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-800">{profile.label}</p>
                  <p className="text-[10px] text-slate-500">{profile.immediatePct}% immédiat / {profile.dcaPct}% DCA</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-800" title={netFiscalHelpTitle}>
                    {formatMoney(profile.netTotal, settings.currency)} net
                  </p>
                  <p className={`text-xs ${gainTone(profile.gain)}`} title={netFiscalHelpTitle}>
                    {formatSignedMoney(profile.gain, settings.currency)}
                  </p>
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Projection détaillée du profil</p>
          </div>
        )}
        {resetNotice && <p className="mb-1 text-[11px] text-emerald-600">{resetNotice}</p>}
        <p className="mb-1 text-[11px] text-slate-500">
          Ajustez les paramètres pour voir l’impact sur votre investissement.
        </p>
        {isMixMode && (
          <div
            className={`mb-2 rounded-xl border p-3 transition-all duration-200 ${
              resultPulse
                ? 'border-indigo-100 bg-indigo-100 scale-100'
                : 'border-indigo-100 bg-indigo-50 scale-[0.98]'
            }`}
            title={`Gain DCA : ${selected10y ? formatSignedMoney(selected10yDcaGain, settings.currency) : '—'} • Gain ponctuel : ${selected10y ? formatSignedMoney(selected10yLumpGain, settings.currency) : '—'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-700">Détail du profil sélectionné</p>
                <p className="text-xs text-slate-600">
                  {selectedProfile.label} — {profileProjection?.immediatePct ?? 0}% immédiat / {profileProjection?.dcaPct ?? 0}% DCA
                </p>
                <p className="text-xs text-slate-500">
                  Scénario : {selectedScenario?.label ?? 'Normal'} ({selectedScenarioBaseRatePct.toFixed(0)}%)
                </p>
                <p className="text-xl font-semibold text-slate-900" title={netFiscalHelpTitle}>
                  Projection à 10 ans ({selectedScenario?.label ?? 'Normal'}) :{' '}
                  {profileProjection?.netTotal != null ? formatMoney(profileProjection.netTotal, settings.currency) : '—'} net
                </p>
                <p className="mt-1 text-xs text-slate-500">Net après fiscalité (PS inclus)</p>
                <p className={`text-base font-medium ${gainTone(profileProjection?.gain ?? 0)}`} title={netFiscalHelpTitle}>
                  Gain estimé : {profileProjection ? formatSignedMoney(profileProjection.gain, settings.currency) : '—'}
                  {profileProjection?.netTotal != null && profileProjection.investedTotal > 0 && (
                    <span className="text-slate-600">
                      {' '}
                      • ~
                      {formatSignedPercent(
                        annualizedReturnApprox(profileProjection.netTotal, profileProjection.investedTotal, 10) ?? 0
                      )} (scénario {selectedScenario?.label ?? 'Normal'})
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  Montant investi : {profileProjection ? formatMoney(profileProjection.investedTotal, settings.currency) : '—'}
                </p>
              </div>
              {profileMainReturnPct != null && (
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${gainTone(profileProjection?.gain ?? 0)} bg-white/90`}>
                  {profileMainReturnPct >= 0 ? '+' : ''}
                  {profileMainReturnPct.toFixed(0)}% sur 10 ans
                </span>
              )}
            </div>
          </div>
        )}
        <p className="mb-1 text-[11px] text-slate-500">
          {projectionMode === 'mix'
            ? `Évolution estimée du profil ${selectedProfile.label}`
            : projectionMode === 'dca'
              ? `Évolution estimée DCA (${selectedScenario?.label ?? 'Normal'})`
              : `Évolution estimée ponctuelle (${selectedScenario?.label ?? 'Normal'})`}
        </p>
        <div className="h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dcaCurveFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={scenarioChartVisual.fillTop} stopOpacity={scenarioChartVisual.fillTopOpacity} />
                  <stop offset="100%" stopColor={scenarioChartVisual.fillBottom} stopOpacity={scenarioChartVisual.fillBottomOpacity} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="year"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickFormatter={(v) => `${v}a`}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#64748b' }}
                width={42}
                tickFormatter={(v) =>
                  Number.isFinite(v)
                    ? new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(v as number)
                    : ''
                }
              />
              <Tooltip
                formatter={(value: number, key: string) => [formatMoney(value, settings.currency), key === 'projected' ? 'Portefeuille net' : 'Investi']}
                labelFormatter={(label) => `${label} ans`}
                contentStyle={{
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#e2e8f0',
                  borderTopWidth: 3,
                  borderTopColor: scenarioChartVisual.tooltipAccent,
                  fontSize: 12,
                }}
              />
              <Area
                dataKey="projected"
                stroke="none"
                fill="url(#dcaCurveFill)"
                isAnimationActive
                animationDuration={700}
              />
              <Line
                dataKey="invested"
                stroke="#9ca3af"
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={700}
              />
              <Line
                dataKey="projected"
                stroke={scenarioChartVisual.stroke}
                strokeWidth={3}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (!payload?.isFinal) return <g />;
                  const finalLabel = formatMoney(payload.projected, settings.currency);
                  return (
                    <g>
                      <circle cx={cx} cy={cy} r={4} fill={scenarioChartVisual.stroke} stroke="#ffffff" strokeWidth={2} />
                      <rect
                        x={cx + 8}
                        y={cy - 12}
                        rx={6}
                        ry={6}
                        width={72}
                        height={18}
                        fill="#ffffff"
                        stroke={scenarioChartVisual.tooltipAccent}
                        strokeOpacity={0.35}
                      />
                      <text x={cx + 14} y={cy + 1} fontSize={10} fill="#334155" fontWeight={600}>
                        {finalLabel}
                      </text>
                    </g>
                  );
                }}
                activeDot={{ r: 4, fill: scenarioChartVisual.stroke, stroke: '#fff', strokeWidth: 2 }}
                isAnimationActive
                animationDuration={700}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          Ligne {scenarioChartVisual.legendLine} = portefeuille net estimé • ligne grise = capital investi • fin {CHART_HORIZON_YEARS} ans :{' '}
          {chartFinalPoint ? formatMoney(chartFinalPoint.projected, settings.currency) : '—'}
        </p>
      </div>

      {!isMixMode && (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {scenarioCards.map((scenario) => (
            <div
              key={scenario.id}
              className={`rounded-lg bg-white p-2.5 transition-colors duration-200 ${
                scenario.id === selectedScenarioId
                  ? 'border-2 border-indigo-500 bg-indigo-50 shadow-sm'
                  : 'border-2 border-slate-200'
              }`}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                {scenario.label} · {scenario.baseRatePct.toFixed(0)}% / an
              </p>
              {scenario.id === selectedScenarioId && (
                <p className="mt-0.5 text-[10px] font-medium text-indigo-700">Scénario actif</p>
              )}
              <div className="mt-2 overflow-hidden rounded-md border border-slate-200">
                <div className="grid grid-cols-3 border-b border-slate-100 px-2 py-1 text-[11px] font-semibold">
                  <span className="text-slate-600">Horizon</span>
                  <span className={scenarioColHeaderLump} title={netFiscalHelpTitle}>
                    Ponctuel net
                    {emphasizeScenarioLumpCol && (
                      <span className="ml-1 text-[9px] font-normal tracking-wide text-indigo-500/90">· vue</span>
                    )}
                  </span>
                  <span className={scenarioColHeaderDca} title={netFiscalHelpTitle}>
                    DCA cumulé net
                    {emphasizeScenarioDcaCol && (
                      <span className="ml-1 text-[9px] font-normal tracking-wide text-indigo-500/90">· vue</span>
                    )}
                  </span>
                </div>
                <div className="divide-y divide-slate-100">
                {scenario.rows.map((row) => (
                  <div
                    key={row.horizon}
                    className={`grid grid-cols-3 px-2 py-2 text-xs text-slate-800 transition-colors hover:bg-slate-50 ${
                      row.horizon === 10 ? 'bg-slate-50/70' : ''
                    }`}
                    title={`Ponctuel brut ${formatMoney(row.grossLump, settings.currency)} / net ${formatMoney(row.netLump, settings.currency)} | DCA cumulé brut ${formatMoney(row.grossDca, settings.currency)} / net ${formatMoney(row.netDca, settings.currency)} | ${taxLegend}`}
                  >
                    <span className={`font-medium ${row.horizon === 10 ? 'text-slate-600' : 'text-slate-700'}`}>
                      {row.horizon === 10 ? '10 ans · repère' : `${row.horizon} ans`}
                    </span>
                    <span className={`flex flex-col space-y-1.5 text-left ${scenarioColCellLump}`} title={netFiscalHelpTitle}>
                      <span className="text-xs font-semibold text-slate-900">{formatMoney(row.netLump, settings.currency)}</span>
                      <span className="text-[11px] text-slate-500">
                        <span>{formatMoney(simulatedLumpSum, settings.currency)}</span>
                        <span className="text-slate-400"> • </span>
                        <span className={gainTone(row.netLump - simulatedLumpSum)}>
                          {formatSignedMoney(row.netLump - simulatedLumpSum, settings.currency)}
                        </span>
                      </span>
                    </span>
                    <span className={`flex flex-col space-y-1.5 text-left ${scenarioColCellDca}`} title={netFiscalHelpTitle}>
                      <span className="text-xs font-semibold text-slate-900">{formatMoney(row.netDca, settings.currency)}</span>
                      <span className="text-[11px] text-slate-500">
                        <span>{formatMoney(investedDcaAmount(simulatedMonthlyDca, row.horizon), settings.currency)}</span>
                        <span className="text-slate-400"> • </span>
                        <span className={gainTone(row.netDca - investedDcaAmount(simulatedMonthlyDca, row.horizon))}>
                          {formatSignedMoney(row.netDca - investedDcaAmount(simulatedMonthlyDca, row.horizon), settings.currency)}
                        </span>
                      </span>
                    </span>
                  </div>
                ))}
                </div>
              </div>
              <p className="mt-1 text-[10px] leading-snug text-slate-500">Détails brut/net et fiscalité au survol.</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 space-y-1 text-xs leading-snug text-slate-500">
        <p>
          Tous les montants affichés sont nets (après prélèvements sociaux sur les gains :{' '}
          <span className="font-semibold text-slate-600">{formatPercentFromDecimal(peaSocialOnGainsRate)} %</span>).
        </p>
        <p className="text-[11px] text-slate-400">Modifiable dans les paramètres fiscaux.</p>
      </div>
    </div>
  );
}
