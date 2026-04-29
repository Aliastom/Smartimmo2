import { describe, expect, it } from 'vitest';
import {
  resolveCautionCashRatioThreshold,
  resolveMinCashReservePercent,
  resolveReinforceCooldownDays,
  resolveSuggestionReopenDrawdownDelta,
  resolveSuggestionSuppressDays,
} from '@/features/market/services/marketGuardrails';
import type { InvestmentSettings } from '@/features/market/types';

function baseSettings(overrides: Partial<InvestmentSettings> = {}): InvestmentSettings {
  return {
    id: 'default',
    organizationId: 'org-1',
    referenceSymbol: 'CW8.PA',
    referenceLabel: 'Test',
    envelope: 'PEA',
    athPeriod: '5Y',
    availableCash: 10000,
    monthlyDcaAmount: 1000,
    reinforce10Threshold: -10,
    reinforce20Threshold: -20,
    reinforce10Amount: 0,
    reinforce20Amount: 0,
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

describe('marketGuardrails', () => {
  it('applique les défauts si champs absents', () => {
    const s = baseSettings();
    expect(resolveMinCashReservePercent(s)).toBe(0);
    expect(resolveCautionCashRatioThreshold(s)).toBe(0.2);
    expect(resolveReinforceCooldownDays(s)).toBe(14);
    expect(resolveSuggestionSuppressDays(s)).toBe(7);
    expect(resolveSuggestionReopenDrawdownDelta(s)).toBe(5);
  });

  it('lit les surcharges depuis investmentStrategy', () => {
    const s = baseSettings({
      investmentStrategy: {
        monthlyDca: 1000,
        reinforceLevels: baseSettings().investmentStrategy!.reinforceLevels,
        minCashReservePercent: 15,
        cautionCashRatioThreshold: 0.35,
        reinforceCooldownDays: 21,
        suggestionSuppressDays: 10,
        suggestionReopenDrawdownDelta: 8,
      },
    });
    expect(resolveMinCashReservePercent(s)).toBe(15);
    expect(resolveCautionCashRatioThreshold(s)).toBe(0.35);
    expect(resolveReinforceCooldownDays(s)).toBe(21);
    expect(resolveSuggestionSuppressDays(s)).toBe(10);
    expect(resolveSuggestionReopenDrawdownDelta(s)).toBe(8);
  });
});
