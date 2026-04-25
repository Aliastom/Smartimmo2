import { describe, expect, it } from 'vitest';
import {
  computeDrawdownPercent,
  computeRecommendation,
  resolveMarketStatus,
} from '@/features/market/services/marketDecisionService';
import type { InvestmentSettings, MarketSnapshot } from '@/features/market/types';

function makeSettings(overrides: Partial<InvestmentSettings> = {}): InvestmentSettings {
  return {
    id: 'default',
    organizationId: 'org-1',
    referenceSymbol: 'CW8.PA',
    referenceLabel: 'Amundi MSCI World PEA',
    envelope: 'PEA',
    athPeriod: '5Y',
    availableCash: 10000,
    monthlyDcaAmount: 1000,
    reinforce10Threshold: -10,
    reinforce20Threshold: -20,
    reinforce10Amount: 500,
    reinforce20Amount: 1200,
    strategy: 'DCA_PLUS_REINFORCE',
    cashReferenceAmount: 10000,
    currency: 'EUR',
    updatedAt: '2026-01-01T00:00:00.000Z',
    investmentStrategy: {
      monthlyDca: 1000,
      reinforceLevels: [
        { threshold: -10, allocationPercent: 10 },
        { threshold: -20, allocationPercent: 20 },
        { threshold: -30, allocationPercent: 30 },
        { threshold: -40, allocationPercent: 40 },
      ],
    },
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    id: 'snap-1',
    organizationId: 'org-1',
    symbol: 'CW8.PA',
    athPeriod: '5Y',
    currentPrice: 82,
    athPrice: 100,
    drawdownPercent: -18,
    athDate: '2025-12-01T00:00:00.000Z',
    fetchedAt: '2026-01-01T00:00:00.000Z',
    source: 'manual',
    ...overrides,
  };
}

describe('marketDecisionService: drawdown', () => {
  it('calcule -18% pour 82 / 100', () => {
    expect(computeDrawdownPercent(82, 100)).toBe(-18);
  });

  it('retourne 0 si ATH invalide ou nul', () => {
    expect(computeDrawdownPercent(82, 0)).toBe(0);
    expect(computeDrawdownPercent(82, -1)).toBe(0);
  });
});

describe('marketDecisionService: statut marché', () => {
  it('retourne NORMAL si drawdown > -10', () => {
    expect(resolveMarketStatus(-9.9, makeSettings())).toBe('NORMAL');
  });

  it('retourne OPPORTUNITE si <= -10 et > -20', () => {
    expect(resolveMarketStatus(-10, makeSettings())).toBe('OPPORTUNITE');
    expect(resolveMarketStatus(-19.99, makeSettings())).toBe('OPPORTUNITE');
  });

  it('retourne FORTE_OPPORTUNITE si <= -20', () => {
    expect(resolveMarketStatus(-20, makeSettings())).toBe('FORTE_OPPORTUNITE');
    expect(resolveMarketStatus(-28, makeSettings())).toBe('FORTE_OPPORTUNITE');
  });

  it('utilise les seuils configurés utilisateur', () => {
    const custom = makeSettings({ reinforce10Threshold: -8, reinforce20Threshold: -16 });
    expect(resolveMarketStatus(-7.9, custom)).toBe('NORMAL');
    expect(resolveMarketStatus(-10, custom)).toBe('OPPORTUNITE');
    expect(resolveMarketStatus(-16, custom)).toBe('FORTE_OPPORTUNITE');
  });
});

describe('marketDecisionService: recommandations V2', () => {
  it('marché haut => DCA uniquement, montant = DCA', () => {
    const rec = computeRecommendation(makeSettings(), makeSnapshot({ drawdownPercent: -5 }), []);
    expect(rec.decisionType).toBe('DCA_ONLY');
    expect(rec.status).toBe('NORMAL');
    expect(rec.suggestedAmount).toBe(1000);
    expect(rec.monthlyDcaPortion).toBe(1000);
    expect(rec.reinforcePortion).toBe(0);
    expect(rec.actionType).toBe('DCA');
    expect(rec.score).toBeGreaterThan(70);
  });

  it('OPPORTUNITE légère => DCA + 10% du cash', () => {
    const rec = computeRecommendation(makeSettings(), makeSnapshot({ drawdownPercent: -15 }), []);
    expect(rec.decisionType).toBe('LIGHT_REINFORCE');
    expect(rec.status).toBe('OPPORTUNITE');
    expect(rec.suggestedAmount).toBe(2000);
    expect(rec.actionType).toBe('REINFORCE_10');
  });

  it('correction marquée => DCA + 20% du cash', () => {
    const rec = computeRecommendation(makeSettings(), makeSnapshot({ drawdownPercent: -22 }), []);
    expect(rec.decisionType).toBe('MEDIUM_REINFORCE');
    expect(rec.status).toBe('FORTE_OPPORTUNITE');
    expect(rec.suggestedAmount).toBe(3000);
    expect(rec.actionType).toBe('REINFORCE_20');
  });

  it('forte baisse => DCA + 30% du cash', () => {
    const rec = computeRecommendation(makeSettings(), makeSnapshot({ drawdownPercent: -35 }), []);
    expect(rec.decisionType).toBe('STRONG_REINFORCE');
    expect(rec.suggestedAmount).toBe(4000);
    expect(rec.actionType).toBe('REINFORCE_30');
  });

  it('plafonne au cash disponible', () => {
    const rec = computeRecommendation(
      makeSettings({ availableCash: 1300, cashReferenceAmount: 6500 }),
      makeSnapshot({ drawdownPercent: -35 }),
      []
    );
    expect(rec.suggestedAmount).toBe(1300);
    expect(rec.cashLimited).toBe(true);
  });

  it('DCA_ONLY stratégie => seulement le DCA même si drawdown profond', () => {
    const rec = computeRecommendation(
      makeSettings({ strategy: 'DCA_ONLY' }),
      makeSnapshot({ drawdownPercent: -25 }),
      []
    );
    expect(rec.decisionType).toBe('DCA_ONLY');
    expect(rec.suggestedAmount).toBe(1000);
    expect(rec.reinforcePortion).toBe(0);
  });

  it('renfort similaire récent => renfort divisé par 2', () => {
    const history = [
      {
        id: '1',
        organizationId: 'org-1',
        date: new Date().toISOString(),
        type: 'REINFORCE_10' as const,
        recommendedAmount: 2000,
        validatedAmount: 2000,
        cashBefore: 10000,
        cashAfter: 8000,
        reason: 'test',
        drawdownAtDecision: -15,
        athPriceAtDecision: 100,
        currentPriceAtDecision: 85,
        symbolAtDecision: 'CW8.PA',
        marketStatusAtDecision: 'OPPORTUNITE' as const,
        athPeriodAtDecision: '5Y' as const,
        status: 'validated' as const,
        thresholdKey: 'CW8.PA:LIGHT_REINFORCE',
      },
    ];
    const rec = computeRecommendation(makeSettings(), makeSnapshot({ drawdownPercent: -16 }), history);
    expect(rec.recentSimilarReinforce).toBe(true);
    expect(rec.suggestedAmount).toBe(1500);
  });
});
