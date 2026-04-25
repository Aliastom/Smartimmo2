import type { InvestmentSettings, InvestmentStrategyConfig, ReinforceLevelConfig } from '@/features/market/types';

export const DEFAULT_REINFORCE_LEVELS: ReinforceLevelConfig[] = [
  { threshold: -10, allocationPercent: 10 },
  { threshold: -20, allocationPercent: 20 },
  { threshold: -30, allocationPercent: 30 },
  { threshold: -40, allocationPercent: 40 },
];

export function defaultInvestmentStrategyConfig(monthlyDca: number): InvestmentStrategyConfig {
  return {
    monthlyDca: Math.max(0, monthlyDca),
    reinforceLevels: DEFAULT_REINFORCE_LEVELS.map((l) => ({ ...l })),
  };
}

/** Niveaux triés du drawdown le moins profond au plus profond (ex. -10 puis -40) */
export function normalizeReinforceLevels(levels: ReinforceLevelConfig[]): ReinforceLevelConfig[] {
  return [...levels]
    .filter((l) => Number.isFinite(l.threshold) && l.threshold <= 0 && Number.isFinite(l.allocationPercent) && l.allocationPercent >= 0)
    .sort((a, b) => b.threshold - a.threshold);
}

export function getEffectiveInvestmentStrategy(settings: InvestmentSettings): InvestmentStrategyConfig {
  const dca = Math.max(0, settings.monthlyDcaAmount);
  const raw = settings.investmentStrategy;
  if (raw && Array.isArray(raw.reinforceLevels) && raw.reinforceLevels.length > 0) {
    const levels = normalizeReinforceLevels(raw.reinforceLevels);
    if (levels.length > 0) {
      return {
        monthlyDca: Number.isFinite(raw.monthlyDca) && raw.monthlyDca >= 0 ? raw.monthlyDca : dca,
        reinforceLevels: levels,
      };
    }
  }
  return defaultInvestmentStrategyConfig(dca);
}

/**
 * Pour un drawdown négatif, retourne le palier actif (le plus profond franchi).
 * Ex. dd=-25 → palier -30 non franchi, palier -20 franchi → allocation 20 %.
 */
export function pickActiveReinforceLevel(
  drawdownPercent: number,
  levels: ReinforceLevelConfig[]
): ReinforceLevelConfig | null {
  if (!levels.length || drawdownPercent > levels[0].threshold) {
    return null;
  }
  let chosen: ReinforceLevelConfig | null = null;
  for (const level of levels) {
    if (drawdownPercent <= level.threshold) {
      chosen = level;
    }
  }
  return chosen;
}
