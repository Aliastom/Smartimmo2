import { describe, expect, it } from 'vitest';
import type { InvestmentRecommendation } from '@/features/market/types';
import {
  adjustInvestmentRecommendationForEmergencyFund,
  computeEmergencyFund,
  resolveAnnualNetIncomeForEmergencyFund,
} from '@/features/patrimoine/services/emergencyFundService';

function baseReco(overrides: Partial<InvestmentRecommendation>): InvestmentRecommendation {
  return {
    status: 'OPPORTUNITE',
    decisionType: 'LIGHT_REINFORCE',
    score: 40,
    marketScoreLabel: 'OPPORTUNITÉ',
    message: 'Renfort + DCA',
    reason: 'test',
    suggestedAmount: 800,
    monthlyDcaPortion: 300,
    reinforcePortion: 500,
    baseAmount: 800,
    cashLimited: false,
    actionType: 'REINFORCE',
    thresholdKey: null,
    confidenceLevel: 'medium',
    prudenceMode: false,
    recentSimilarReinforce: false,
    ...overrides,
  };
}

describe('resolveAnnualNetIncomeForEmergencyFund', () => {
  it('priorise revenuGlobalEstime quand suffisant', () => {
    const r = resolveAnnualNetIncomeForEmergencyFund({
      revenuGlobalEstime: 24_000,
      revenuLocatifNetAnnual: 12_000,
      hasFiscalSimulation: true,
    });
    expect(r.annualNetIncome).toBe(24_000);
    expect(r.incomeSource).toBe('REVENU_GLOBAL_ESTIME');
  });

  it('fallback locatif si agrégat nul et simulation fiscale présente', () => {
    const r = resolveAnnualNetIncomeForEmergencyFund({
      revenuGlobalEstime: 0,
      revenuLocatifNetAnnual: 18_000,
      hasFiscalSimulation: true,
    });
    expect(r.annualNetIncome).toBe(18_000);
    expect(r.incomeSource).toBe('LOCATIF_NET_SEUL');
  });

  it('indisponible sans revenu exploitable', () => {
    const r = resolveAnnualNetIncomeForEmergencyFund({
      revenuGlobalEstime: 0,
      revenuLocatifNetAnnual: 0,
      hasFiscalSimulation: false,
    });
    expect(r.annualNetIncome).toBeNull();
    expect(r.incomeSource).toBe('INDISPONIBLE');
  });
});

describe('computeEmergencyFund — statuts', () => {
  it('CRITIQUE si couverture < 3 mois', () => {
    const f = computeEmergencyFund({
      currentCash: 2000,
      revenuGlobalEstime: 24_000,
      revenuLocatifNetAnnual: 0,
      hasFiscalSimulation: true,
    });
    expect(f.monthlyNetIncome).toBe(2000);
    expect(f.coverageMonths).toBe(1);
    expect(f.status).toBe('CRITIQUE');
    expect(f.emergencyFundMin).toBe(6000);
    expect(f.emergencyFundTarget).toBe(12_000);
  });

  it('À RENFORCER entre 3 et 6 mois', () => {
    const f = computeEmergencyFund({
      currentCash: 10_000,
      revenuGlobalEstime: 24_000,
      revenuLocatifNetAnnual: 0,
      hasFiscalSimulation: true,
    });
    expect(f.status).toBe('A_RENFORCER');
    expect(f.coverageMonths).toBe(5);
  });

  it('CONFORTABLE si couverture ≥ 6 mois', () => {
    const f = computeEmergencyFund({
      currentCash: 14_000,
      revenuGlobalEstime: 24_000,
      revenuLocatifNetAnnual: 0,
      hasFiscalSimulation: true,
    });
    expect(f.status).toBe('CONFORTABLE');
    expect(f.coverageMonths).toBeGreaterThanOrEqual(6);
  });
});

describe('adjustInvestmentRecommendationForEmergencyFund', () => {
  it('CRITIQUE : supprime le renfort et réduit le DCA', () => {
    const raw = baseReco({ monthlyDcaPortion: 400, reinforcePortion: 600 });
    const adj = adjustInvestmentRecommendationForEmergencyFund(raw, { status: 'CRITIQUE' });
    expect(adj.reinforcePortion).toBe(0);
    expect(adj.monthlyDcaPortion).toBe(200);
    expect(adj.message).toContain('Priorité');
    expect(adj.suggestedAmount).toBe(200);
  });

  it('À RENFORCER : divise le renfort par 2', () => {
    const raw = baseReco({ reinforcePortion: 400, monthlyDcaPortion: 200 });
    const adj = adjustInvestmentRecommendationForEmergencyFund(raw, { status: 'A_RENFORCER' });
    expect(adj.reinforcePortion).toBe(200);
    expect(adj.monthlyDcaPortion).toBe(200);
    expect(adj.suggestedAmount).toBe(400);
  });

  it('CONFORTABLE : inchangé', () => {
    const raw = baseReco({});
    const adj = adjustInvestmentRecommendationForEmergencyFund(raw, { status: 'CONFORTABLE' });
    expect(adj).toBe(raw);
  });
});
