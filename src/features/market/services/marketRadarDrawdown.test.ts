import { describe, expect, it } from 'vitest';
import { computeDrawdownPercent } from '@/features/market/services/marketDecisionService';

describe('Radar drawdown par ETF (prix distincts)', () => {
  it('recalcule ((current - ath) / ath) * 100 pour chaque paire', () => {
    const cw8 = computeDrawdownPercent(635.73, 637.38);
    const ewld = computeDrawdownPercent(37.65, 37.75);
    const wpea = computeDrawdownPercent(6.4, 6.42);
    expect(cw8).toBeCloseTo(-0.25887, 4);
    expect(ewld).toBeCloseTo(-0.2649, 4);
    expect(wpea).toBeCloseTo(-0.31153, 4);
  });

  it('à 2 décimales CW8 et EWLD peuvent coïncider ; WPEA reste distinct', () => {
    const cw8 = computeDrawdownPercent(635.73, 637.38);
    const ewld = computeDrawdownPercent(37.65, 37.75);
    const wpea = computeDrawdownPercent(6.4, 6.42);
    expect(cw8.toFixed(2)).toBe(ewld.toFixed(2));
    expect(wpea.toFixed(2)).not.toBe(cw8.toFixed(2));
  });

  it('au moins 3 décimales distinguent CW8 et EWLD', () => {
    const cw8 = computeDrawdownPercent(635.73, 637.38);
    const ewld = computeDrawdownPercent(37.65, 37.75);
    expect(cw8.toFixed(3)).not.toBe(ewld.toFixed(3));
  });
});
