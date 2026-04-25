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
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<MarketSnapshot> = {}): MarketSnapshot {
  return {
    id: 'snap-1',
    organizationId: 'org-1',
    symbol: 'CW8.PA',
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

describe('marketDecisionService: recommandations', () => {
  it('NORMAL => pas de suggestion d’investissement', () => {
    const rec = computeRecommendation(
      makeSettings(),
      makeSnapshot({ drawdownPercent: -5 })
    );
    expect(rec.status).toBe('NORMAL');
    expect(rec.suggestedAmount).toBe(0);
    expect(rec.baseAmount).toBe(1000);
    expect(rec.message).toBe('RAS marché');
    expect(rec.actionType).toBe('DCA');
  });

  it('OPPORTUNITE => DCA + renfort -10', () => {
    const rec = computeRecommendation(
      makeSettings(),
      makeSnapshot({ drawdownPercent: -15 })
    );
    expect(rec.status).toBe('OPPORTUNITE');
    expect(rec.suggestedAmount).toBe(1500);
    expect(rec.actionType).toBe('REINFORCE_10');
  });

  it('FORTE_OPPORTUNITE => DCA + renfort -20', () => {
    const rec = computeRecommendation(
      makeSettings(),
      makeSnapshot({ drawdownPercent: -22 })
    );
    expect(rec.status).toBe('FORTE_OPPORTUNITE');
    expect(rec.suggestedAmount).toBe(2200);
    expect(rec.actionType).toBe('REINFORCE_20');
  });

  it('plafonne au cash disponible', () => {
    const rec = computeRecommendation(
      makeSettings({ availableCash: 1300 }),
      makeSnapshot({ drawdownPercent: -22 })
    );
    expect(rec.suggestedAmount).toBe(1300);
    expect(rec.cashLimited).toBe(true);
  });

  it('DCA_ONLY => DCA même si drawdown <= -20', () => {
    const rec = computeRecommendation(
      makeSettings({ strategy: 'DCA_ONLY' }),
      makeSnapshot({ drawdownPercent: -25 })
    );
    expect(rec.status).toBe('FORTE_OPPORTUNITE');
    expect(rec.suggestedAmount).toBe(1000);
    expect(rec.baseAmount).toBe(1000);
  });

  it('à -0.3% => NORMAL et aucune opportunité', () => {
    const rec = computeRecommendation(
      makeSettings(),
      makeSnapshot({ drawdownPercent: -0.3 })
    );
    expect(rec.status).toBe('NORMAL');
    expect(rec.suggestedAmount).toBe(0);
  });
});

