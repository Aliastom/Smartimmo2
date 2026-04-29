import { describe, expect, it } from 'vitest';
import {
  computeDrawdownPercent,
  computeRecommendation,
  resolveDecisionTypeFromDrawdown,
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

  it('retourne NORMAL si drawdown non fini', () => {
    expect(resolveMarketStatus(Number.NaN, makeSettings())).toBe('NORMAL');
    expect(resolveMarketStatus(Number.POSITIVE_INFINITY, makeSettings())).toBe('NORMAL');
  });
});

describe('resolveDecisionTypeFromDrawdown', () => {
  it('suit les seuils paramétrables et reste cohérent avec resolveMarketStatus en zone légère', () => {
    const s = makeSettings({ reinforce10Threshold: -8, reinforce20Threshold: -16 });
    expect(resolveDecisionTypeFromDrawdown(s, -7)).toBe('DCA_ONLY');
    expect(resolveMarketStatus(-7, s)).toBe('NORMAL');
    expect(resolveDecisionTypeFromDrawdown(s, -12)).toBe('LIGHT_REINFORCE');
    expect(resolveMarketStatus(-12, s)).toBe('OPPORTUNITE');
  });

  it('dérive la zone MEDIUM/STRONG depuis les paliers % cash', () => {
    const s = makeSettings();
    expect(resolveDecisionTypeFromDrawdown(s, -22)).toBe('MEDIUM_REINFORCE');
    expect(resolveDecisionTypeFromDrawdown(s, -35)).toBe('STRONG_REINFORCE');
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

  it('drawdown NaN => DCA uniquement, pas de renfort, données insuffisantes', () => {
    const rec = computeRecommendation(makeSettings(), makeSnapshot({ drawdownPercent: Number.NaN }), []);
    expect(rec.decisionType).toBe('DCA_ONLY');
    expect(rec.insufficientMarketData).toBe(true);
    expect(rec.reinforcePortion).toBe(0);
    expect(rec.suggestedAmount).toBe(1000);
    expect(rec.actionType).toBe('DCA');
    expect(rec.status).toBe('NORMAL');
  });

  it('même logique radar / principal : historique vide vs historique avec renfort similaire', () => {
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
    const snap = makeSnapshot({ drawdownPercent: -16 });
    const avecHistorique = computeRecommendation(makeSettings(), snap, history);
    const sansHistorique = computeRecommendation(makeSettings(), snap, []);
    expect(avecHistorique.recentSimilarReinforce).toBe(true);
    expect(sansHistorique.recentSimilarReinforce).toBe(false);
    expect(avecHistorique.suggestedAmount).toBe(1500);
    expect(sansHistorique.suggestedAmount).toBe(2000);
  });

  it('renfort similaire : autre symbole dans l’historique ne réduit pas le renfort', () => {
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
        symbolAtDecision: 'OTHER.PA',
        marketStatusAtDecision: 'OPPORTUNITE' as const,
        athPeriodAtDecision: '5Y' as const,
        status: 'validated' as const,
        thresholdKey: 'OTHER.PA:LIGHT_REINFORCE',
      },
    ];
    const rec = computeRecommendation(makeSettings(), makeSnapshot({ symbol: 'CW8.PA', drawdownPercent: -16 }), history);
    expect(rec.recentSimilarReinforce).toBe(false);
    expect(rec.suggestedAmount).toBe(2000);
  });

  it('réserve cash minimale : plafonne le montant suggéré', () => {
    const s = makeSettings({
      minCashReservePercent: 80,
      cashReferenceAmount: 10000,
      availableCash: 10000,
    });
    const rec = computeRecommendation(s, makeSnapshot({ drawdownPercent: -35 }), []);
    expect(rec.suggestedAmount).toBe(2000);
  });

  it('seuil prudence personnalisé atténue le renfort', () => {
    const s = makeSettings({
      cautionCashRatioThreshold: 0.5,
      availableCash: 4000,
      cashReferenceAmount: 10000,
    });
    const rec = computeRecommendation(s, makeSnapshot({ drawdownPercent: -15 }), []);
    expect(rec.prudenceMode).toBe(true);
    // 10 % du cash disponible (4000) = 400, puis moitié en mode prudence = 200
    expect(rec.reinforcePortion).toBe(200);
  });

  it('cooldown renfort paramétrable : hors fenêtre = pas de renfort similaire', () => {
    const s = makeSettings({ reinforceCooldownDays: 3 });
    const history = [
      {
        id: '1',
        organizationId: 'org-1',
        date: '2026-01-01T00:00:00.000Z',
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
    const rec = computeRecommendation(s, makeSnapshot({ drawdownPercent: -16 }), history, {
      nowMs: new Date('2026-01-05T12:00:00.000Z').getTime(),
    });
    expect(rec.recentSimilarReinforce).toBe(false);
    expect(rec.suggestedAmount).toBe(2000);
  });
});
