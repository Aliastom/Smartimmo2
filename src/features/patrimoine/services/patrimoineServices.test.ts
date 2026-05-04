import { describe, expect, it } from 'vitest';
import { computeAllocationScore } from '@/features/patrimoine/services/patrimoineAllocationScore';
import {
  computePatrimoineRecommendation,
  computePriorityActions,
  type PatrimoineDecisionInput,
} from '@/features/patrimoine/services/patrimoineDecisionService';
import { computeCashflowProjection } from '@/features/patrimoine/services/patrimoineProjectionService';
import { buildPatrimoineRecommendationTrace } from '@/features/patrimoine/services/patrimoineRecommendationTrace';
import { minimalPatrimoineSnapshot } from '@/features/patrimoine/test/patrimoineSnapshot.fixture';

function baseDecisionInput(overrides: Partial<PatrimoineDecisionInput> = {}): PatrimoineDecisionInput {
  return {
    drawdownPercent: null,
    athDistancePercent: null,
    scoreAllocation: 50,
    allocationEtf: 0.25,
    allocationImmo: 0.5,
    cashExcess: 1000,
    investableCash: 1000,
    patrimoineNetGlobal: 100_000,
    marketMonthlyDcaPortion: 300,
    marketReinforcePortion: 0,
    marketSuggestedTotal: 0,
    marketScore: null,
    marketScoreLabel: null,
    marketStatus: null,
    marketDecisionType: null,
    insufficientMarketData: true,
    isNearAthMarket: false,
    objective: 'equilibre',
    ...overrides,
  };
}

describe('computeAllocationScore', () => {
  it('retourne 0 si valeur invalide', () => {
    expect(computeAllocationScore(Number.NaN)).toBe(0);
    expect(computeAllocationScore(-1)).toBe(0);
  });

  it('score dans la zone cible ~30 % ETF', () => {
    const s = computeAllocationScore(0.3);
    expect(s).toBeGreaterThan(85);
    expect(s).toBeLessThanOrEqual(100);
  });

  it('trop d’ETF (>60 %) : score plus bas', () => {
    expect(computeAllocationScore(0.65)).toBeLessThan(computeAllocationScore(0.3));
  });
});

describe('computePatrimoineRecommendation', () => {
  it('sans données marché : branche « marché élevé » ignorée (DCA prudent non forcé)', () => {
    const input = baseDecisionInput({
      insufficientMarketData: true,
      drawdownPercent: -5,
      marketScore: 75,
      marketScoreLabel: 'MARCHÉ HAUT',
      isNearAthMarket: false,
    });
    const r = computePatrimoineRecommendation(input);
    expect(r.message.length).toBeGreaterThan(0);
    expect(['DCA', 'REINFORCE', 'WAIT']).toContain(r.primaryAction);
  });

  it('drawdown -15 % + cash investissable + croissance → REINFORCE opportunité', () => {
    const input = baseDecisionInput({
      insufficientMarketData: false,
      drawdownPercent: -15,
      investableCash: 10_000,
      objective: 'croissance',
      marketMonthlyDcaPortion: 500,
      marketReinforcePortion: 400,
    });
    const r = computePatrimoineRecommendation(input);
    expect(r.primaryAction).toBe('REINFORCE');
    expect(r.level).toBe('OPPORTUNITY');
    expect(r.reinforceAmount).toBeGreaterThan(0);
  });

  it('épargne sécurité CRITIQUE : bloque le renfort opportuniste', () => {
    const input = baseDecisionInput({
      insufficientMarketData: false,
      drawdownPercent: -15,
      investableCash: 10_000,
      objective: 'croissance',
      marketMonthlyDcaPortion: 500,
      marketReinforcePortion: 400,
      emergencyFundStatus: 'CRITIQUE',
    });
    const r = computePatrimoineRecommendation(input);
    expect(r.primaryAction).not.toBe('REINFORCE');
    expect(r.reinforceAmount).toBe(0);
  });

  it('objectif sécurité : seuil renfort 5000 € — pas de renfort à 4500 € alors que croissance renforce', () => {
    const common = {
      insufficientMarketData: false,
      drawdownPercent: -15 as number | null,
      investableCash: 4500,
      marketMonthlyDcaPortion: 200,
      marketReinforcePortion: 0,
    };
    const rSec = computePatrimoineRecommendation({
      ...baseDecisionInput(common),
      objective: 'securite',
    });
    const rCrois = computePatrimoineRecommendation({
      ...baseDecisionInput(common),
      objective: 'croissance',
    });
    expect(rCrois.primaryAction).toBe('REINFORCE');
    expect(rSec.primaryAction).not.toBe('REINFORCE');
  });

  it('objectif équilibre : excès de cash > 5000 € → WARNING', () => {
    const input = baseDecisionInput({
      insufficientMarketData: true,
      cashExcess: 8000,
      allocationImmo: 0.4,
      allocationEtf: 0.35,
      patrimoineNetGlobal: 100_000,
      drawdownPercent: null,
    });
    const r = computePatrimoineRecommendation(input);
    expect(r.primaryAction).toBe('WAIT');
    expect(r.level).toBe('WARNING');
  });

  it('cash sous coussin + pas de réserves : message prudent sans crash', () => {
    const input = baseDecisionInput({
      cashExcess: -1000,
      investableCash: 0,
      allocationEtf: 0.25,
      allocationImmo: 0.45,
      insufficientMarketData: true,
    });
    const r = computePatrimoineRecommendation(input);
    expect(r.primaryAction).toBeDefined();
    expect(Number.isFinite(r.dcaAmount)).toBe(true);
  });
});

describe('computePriorityActions', () => {
  it('sans simulation fiscale : action fiscalité avec score bas', () => {
    const actions = computePriorityActions({
      objective: 'equilibre',
      dcaMonthlyAmount: 100,
      reinforceSuggested: 0,
      drawdownPercent: null,
      investableCash: 2000,
      fiscalResteAPayer: null,
      fiscalEffortMensuel: null,
      cashExcess: 1000,
      cashSecurite: 5000,
    });
    const fiscal = actions.find((a) => a.type === 'OPTIMIZE_FISCAL');
    expect(fiscal).toBeDefined();
    expect(fiscal?.label).toMatch(/simulation/i);
  });

  it('cash inférieur au coussin : pas de « trop de cash » prioritaire', () => {
    const actions = computePriorityActions({
      objective: 'equilibre',
      dcaMonthlyAmount: 50,
      reinforceSuggested: 0,
      drawdownPercent: -20,
      investableCash: 0,
      fiscalResteAPayer: null,
      fiscalEffortMensuel: null,
      cashExcess: 0,
      cashSecurite: 5000,
    });
    expect(actions.length).toBe(4);
    const reduce = actions.find((a) => a.type === 'REDUCE_CASH');
    expect(reduce?.priority).toBeGreaterThan(1);
  });

  it('marché -15 % et cash investissable : renfort présent dans le classement', () => {
    const actions = computePriorityActions({
      objective: 'croissance',
      dcaMonthlyAmount: 200,
      reinforceSuggested: 600,
      drawdownPercent: -15,
      investableCash: 8000,
      fiscalResteAPayer: 100,
      fiscalEffortMensuel: 50,
      cashExcess: 4000,
      cashSecurite: 2000,
    });
    expect(actions.some((a) => a.type === 'REINFORCE')).toBe(true);
  });
});

describe('computeCashflowProjection', () => {
  it('valeurs 0 / NaN sur rendement : pas Infinity ni NaN en sortie', () => {
    const r = computeCashflowProjection(
      {
        initialCash: 0,
        initialPatrimoine: 0,
        monthlyCapacity: 0,
        monthlyFiscalEffort: 0,
        monthlyDca: 0,
        annualPatrimoineYield: Number.NaN,
      },
      1
    );
    expect(Number.isFinite(r.patrimoineDeltaRatio)).toBe(true);
    expect(r.points.every((p) => Number.isFinite(p.cash) && Number.isFinite(p.patrimoine))).toBe(true);
  });

  it('rendement annuel ≤ 0 : tendance classifiable', () => {
    const r = computeCashflowProjection(
      {
        initialCash: 10_000,
        initialPatrimoine: 50_000,
        monthlyCapacity: 500,
        monthlyFiscalEffort: 100,
        monthlyDca: 200,
        annualPatrimoineYield: 0,
      },
      5
    );
    expect(['croissance', 'stagnation', 'degradation']).toContain(r.trend);
  });
});

describe('buildPatrimoineRecommendationTrace', () => {
  it('sans fiscal ni marché : libellés attendus', () => {
    const snap = minimalPatrimoineSnapshot({
      hasFiscalSimulation: false,
      hasMarketData: false,
      drawdownPercent: null,
    });
    const rows = buildPatrimoineRecommendationTrace(snap);
    expect(rows.find((r) => r.label === 'Fiscalité')?.value).toBe('Non reliée');
    expect(rows.find((r) => r.label === 'Marché')?.value).toBe('Non disponible');
    expect(rows.find((r) => r.label === 'Cash investissable')).toBeDefined();
  });

  it('marché -15 % ATH + cash investissable affiché', () => {
    const snap = minimalPatrimoineSnapshot({
      hasMarketData: true,
      drawdownPercent: -15,
      investableCash: 10_000,
    });
    const rows = buildPatrimoineRecommendationTrace(snap);
    expect(rows.find((r) => r.label === 'Marché')?.value).toContain('-15.0');
    const cashVal = rows.find((r) => r.label === 'Cash investissable')?.value ?? '';
    expect(cashVal).toContain('10');
    expect(cashVal).toContain('000');
  });

  it('allocation ETF NaN : affiche 0 % sans NaN', () => {
    const snap = minimalPatrimoineSnapshot({
      allocationEtf: Number.NaN as unknown as number,
    });
    const rows = buildPatrimoineRecommendationTrace(snap);
    const alloc = rows.find((r) => r.label === 'Allocation ETF');
    expect(alloc?.value).toBe('0 %');
    expect(alloc?.value).not.toMatch(/NaN/i);
  });

  it('fiscalité reliée : mention Auto selon le mode de sélection', () => {
    const snap = minimalPatrimoineSnapshot({
      hasFiscalSimulation: true,
      revenuLocatifNet: 7704,
      fiscalSimulationSelectionMode: 'AUTO',
    });
    const fiscalRow = buildPatrimoineRecommendationTrace(snap).find((r) => r.label === 'Fiscalité');
    expect(fiscalRow?.value).toContain('Simulation fiscale · Auto');
    expect(fiscalRow?.value).toContain('7');
  });

  it('marché : source trace Auto vs Choisi', () => {
    const autoSnap = minimalPatrimoineSnapshot({
      hasMarketData: true,
      availableMarketInvestments: [{ id: 'x', label: 'L' }],
      marketInvestmentSelectionMode: 'AUTO',
    });
    const mRow = buildPatrimoineRecommendationTrace(autoSnap).find((r) => r.label === 'Marché');
    expect(mRow?.source).toContain('Module Marché · Auto');

    const manSnap = minimalPatrimoineSnapshot({
      hasMarketData: true,
      availableMarketInvestments: [{ id: 'x', label: 'L' }],
      marketInvestmentSelectionMode: 'MANUAL',
    });
    const m2 = buildPatrimoineRecommendationTrace(manSnap).find((r) => r.label === 'Marché');
    expect(m2?.source).toContain('Module Marché · Choisi');
  });
});
