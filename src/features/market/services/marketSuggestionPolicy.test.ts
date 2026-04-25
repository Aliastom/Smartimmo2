import { describe, expect, it } from 'vitest';
import { shouldSuppressSuggestion } from '@/features/market/services/marketSuggestionPolicy';
import type { InvestmentActionLog } from '@/features/market/types';

function makeLog(overrides: Partial<InvestmentActionLog> = {}): InvestmentActionLog {
  return {
    id: 'log-1',
    organizationId: 'org-1',
    date: '2026-01-10T00:00:00.000Z',
    type: 'REINFORCE_10',
    recommendedAmount: 1500,
    validatedAmount: 1500,
    cashBefore: 10000,
    cashAfter: 8500,
    reason: 'Drawdown -12% sous ATH 5Y — Opportunité',
    drawdownAtDecision: -12,
    athPriceAtDecision: 100,
    currentPriceAtDecision: 88,
    symbolAtDecision: 'CW8.PA',
    marketStatusAtDecision: 'OPPORTUNITE',
    athPeriodAtDecision: '5Y',
    status: 'validated',
    thresholdKey: 'CW8.PA:OPPORTUNITE',
    marketLevelKey: 'OPPORTUNITE',
    drawdownPercentAtAction: -12,
    note: null,
    ...overrides,
  };
}

describe('marketSuggestionPolicy: anti-spam', () => {
  it('supprime une proposition identique traitée récemment', () => {
    const shouldSuppress = shouldSuppressSuggestion({
      latestDecision: makeLog(),
      currentDrawdownPercent: -12.1,
      manualAnalysisAt: null,
      nowMs: new Date('2026-01-12T00:00:00.000Z').getTime(),
    });
    expect(shouldSuppress).toBe(true);
  });

  it('repropose si dernière décision > 7 jours', () => {
    const shouldSuppress = shouldSuppressSuggestion({
      latestDecision: makeLog({ date: '2026-01-01T00:00:00.000Z' }),
      currentDrawdownPercent: -12.2,
      manualAnalysisAt: null,
      nowMs: new Date('2026-01-12T00:00:00.000Z').getTime(),
    });
    expect(shouldSuppress).toBe(false);
  });

  it("repropose si drawdown aggravé d'au moins 5 points", () => {
    const shouldSuppress = shouldSuppressSuggestion({
      latestDecision: makeLog({ drawdownAtDecision: -12 }),
      currentDrawdownPercent: -17.2,
      manualAnalysisAt: null,
      nowMs: new Date('2026-01-12T00:00:00.000Z').getTime(),
    });
    expect(shouldSuppress).toBe(false);
  });

  it('repropose si une analyse manuelle est demandée', () => {
    const now = new Date('2026-01-12T00:00:00.000Z').getTime();
    const shouldSuppress = shouldSuppressSuggestion({
      latestDecision: makeLog(),
      currentDrawdownPercent: -12.1,
      manualAnalysisAt: now - 30_000,
      nowMs: now,
    });
    expect(shouldSuppress).toBe(false);
  });
});

