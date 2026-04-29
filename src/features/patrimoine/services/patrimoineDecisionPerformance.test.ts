import { describe, expect, it } from 'vitest';
import {
  computePatrimoineDecisionPerformance,
  findNearestHistoricalPrice,
} from '@/features/patrimoine/services/patrimoineDecisionPerformance';
import type { InvestmentActionLog } from '@/features/market/types';

function baseLog(overrides: Partial<InvestmentActionLog> = {}): InvestmentActionLog {
  return {
    id: 'log-1',
    organizationId: 'org-1',
    date: '2026-01-15T12:00:00.000Z',
    type: 'DCA',
    recommendedAmount: 1000,
    validatedAmount: 1000,
    cashBefore: 5000,
    cashAfter: 4000,
    reason: 'test',
    drawdownAtDecision: 0,
    athPriceAtDecision: 100,
    currentPriceAtDecision: 50,
    symbolAtDecision: 'CW8.PA',
    marketStatusAtDecision: 'NORMAL',
    athPeriodAtDecision: 'MAX',
    status: 'validated',
    ...overrides,
  };
}

describe('patrimoineDecisionPerformance', () => {
  it('calcule performance simple (gain positif)', () => {
    const rows = computePatrimoineDecisionPerformance({
      logs: [baseLog({ validatedAmount: 1000, currentPriceAtDecision: 100 })],
      priceHistory: [],
      currentPrice: 110,
      referenceSymbol: 'CW8.PA',
      limit: 5,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].calculable).toBe(true);
    expect(rows[0].estimatedUnits).toBeCloseTo(10, 5);
    expect(rows[0].estimatedValue).toBeCloseTo(1100, 5);
    expect(rows[0].gain).toBeCloseTo(100, 5);
    expect(rows[0].perfPercent).toBeCloseTo(0.1, 5);
  });

  it('gain négatif si cours baisse', () => {
    const rows = computePatrimoineDecisionPerformance({
      logs: [baseLog({ validatedAmount: 1000, currentPriceAtDecision: 100 })],
      priceHistory: [],
      currentPrice: 90,
      referenceSymbol: 'CW8.PA',
    });
    expect(rows[0].calculable).toBe(true);
    expect(rows[0].gain).toBeCloseTo(-100, 5);
    expect(rows[0].perfPercent).toBeCloseTo(-0.1, 5);
  });

  it('sans prix décision ni historique = non calculable', () => {
    const rows = computePatrimoineDecisionPerformance({
      logs: [baseLog({ currentPriceAtDecision: 0 })],
      priceHistory: [],
      currentPrice: 100,
      referenceSymbol: 'CW8.PA',
    });
    expect(rows[0].calculable).toBe(false);
    expect(rows[0].priceAtDecision).toBeNull();
  });

  it('fallback prix via historique proche', () => {
    const rows = computePatrimoineDecisionPerformance({
      logs: [baseLog({ currentPriceAtDecision: 0, date: '2026-03-10T12:00:00.000Z' })],
      priceHistory: [
        { date: '2026-03-01', close: 95, high: null },
        { date: '2026-03-11', close: 105, high: null },
      ],
      currentPrice: 120,
      referenceSymbol: 'CW8.PA',
    });
    expect(rows[0].priceAtDecision).toBe(105);
    expect(rows[0].calculable).toBe(true);
  });

  it('findNearestHistoricalPrice retourne le plus proche', () => {
    const p = findNearestHistoricalPrice(
      [
        { date: '2026-01-01', close: 10, high: null },
        { date: '2026-06-01', close: 20, high: null },
      ],
      '2026-05-15T12:00:00.000Z'
    );
    expect(p).toBe(20);
  });

  it('filtre par symbole de référence', () => {
    const rows = computePatrimoineDecisionPerformance({
      logs: [baseLog({ symbolAtDecision: 'OTHER.PA' })],
      priceHistory: [],
      currentPrice: 100,
      referenceSymbol: 'CW8.PA',
    });
    expect(rows).toHaveLength(0);
  });
});
