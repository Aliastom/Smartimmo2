import { describe, expect, it } from 'vitest';
import { normalizeReinforceLevels, pickActiveReinforceLevel } from '@/features/market/services/marketInvestmentStrategy';

describe('marketInvestmentStrategy', () => {
  it('normalise et trie les paliers du moins profond au plus profond', () => {
    const levels = normalizeReinforceLevels([
      { threshold: -30, allocationPercent: 30 },
      { threshold: -10, allocationPercent: 10 },
    ]);
    expect(levels.map((l) => l.threshold)).toEqual([-10, -30]);
  });

  it('choisit le palier le plus profond franchi', () => {
    const levels = normalizeReinforceLevels([
      { threshold: -10, allocationPercent: 10 },
      { threshold: -20, allocationPercent: 20 },
      { threshold: -30, allocationPercent: 30 },
    ]);
    expect(pickActiveReinforceLevel(-15, levels)?.allocationPercent).toBe(10);
    expect(pickActiveReinforceLevel(-25, levels)?.allocationPercent).toBe(20);
    expect(pickActiveReinforceLevel(-35, levels)?.allocationPercent).toBe(30);
  });
});
