import { describe, expect, it } from 'vitest';
import {
  computeStrategySimulation,
  STRATEGY_SIM_HIGH_FACTOR,
  STRATEGY_SIM_LOW_FACTOR,
  STRATEGY_SIM_WAIT_MONTHS,
} from '@/features/market/services/marketStrategySimulation';

function assertFiniteLine(line: { estimatedValue: number; lowEstimate: number; highEstimate: number }) {
  expect(Number.isFinite(line.estimatedValue)).toBe(true);
  expect(Number.isFinite(line.lowEstimate)).toBe(true);
  expect(Number.isFinite(line.highEstimate)).toBe(true);
  expect(line.lowEstimate).toBe(Math.round(line.estimatedValue * STRATEGY_SIM_LOW_FACTOR));
  expect(line.highEstimate).toBe(Math.round(line.estimatedValue * STRATEGY_SIM_HIGH_FACTOR));
}

describe('marketStrategySimulation', () => {
  it('avec DCA 1000 et lump 15k sur 5 ans, le DCA capitalise plus que le lump (hypothèses fixes)', () => {
    const sim = computeStrategySimulation({ monthlyDca: 1000, lumpSumCash: 15000 });
    const lump = sim.lines.find((l) => l.id === 'lump')!.estimatedValue;
    const wait = sim.lines.find((l) => l.id === 'wait')!.estimatedValue;
    const dca = sim.lines.find((l) => l.id === 'dca')!.estimatedValue;
    expect(dca).toBeGreaterThan(lump);
    expect(lump).toBeGreaterThan(wait);
    expect(sim.bestNumericId).toBe('dca');
  });

  it('chaque scénario expose estimatedValue et fourchette 0.9 / 1.1 numériques', () => {
    const sim = computeStrategySimulation({ monthlyDca: 1000, lumpSumCash: 15000 });
    for (const line of sim.lines) {
      assertFiniteLine(line);
      expect(String(line.lowEstimate)).not.toMatch(/NaN/i);
      expect(String(line.highEstimate)).not.toMatch(/NaN/i);
    }
  });

  it('identifie le DCA comme seul flux si lump nul', () => {
    const sim = computeStrategySimulation({ monthlyDca: 500, lumpSumCash: 0 });
    expect(sim.lines.find((l) => l.id === 'lump')!.estimatedValue).toBe(0);
    expect(sim.lines.find((l) => l.id === 'lump')!.lowEstimate).toBe(0);
    expect(sim.lines.find((l) => l.id === 'lump')!.highEstimate).toBe(0);
    expect(sim.bestNumericId).toBe('dca');
  });

  it('expose le délai d’attente configuré', () => {
    expect(STRATEGY_SIM_WAIT_MONTHS).toBe(6);
  });

  it('la chaîne de fourchette type UI ne contient jamais NaN', () => {
    const sim = computeStrategySimulation({ monthlyDca: 1000, lumpSumCash: 15000 });
    const fmt = (v: number) =>
      new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
    for (const line of sim.lines) {
      expect(Number.isFinite(line.lowEstimate) && Number.isFinite(line.highEstimate)).toBe(true);
      const s = `(${fmt(line.lowEstimate)} – ${fmt(line.highEstimate)})`;
      expect(s).not.toContain('NaN');
    }
  });
});
