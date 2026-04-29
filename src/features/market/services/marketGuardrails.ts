import type { InvestmentSettings } from '@/features/market/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function strategyExtras(settings: InvestmentSettings): Record<string, unknown> {
  const s = settings.investmentStrategy;
  return s && typeof s === 'object' ? (s as Record<string, unknown>) : {};
}

function pickNumber(
  settings: InvestmentSettings,
  key: string,
  fallback: number,
  valid: (n: number) => boolean
): number {
  const strat = strategyExtras(settings)[key];
  const root = (settings as Record<string, unknown>)[key];
  const raw = typeof strat === 'number' && Number.isFinite(strat) ? strat : typeof root === 'number' && Number.isFinite(root) ? root : undefined;
  if (raw !== undefined && valid(raw)) return raw;
  return fallback;
}

/** % du cash de référence à conserver — 0 = désactivé (comportement historique). */
export function resolveMinCashReservePercent(settings: InvestmentSettings): number {
  return pickNumber(settings, 'minCashReservePercent', 0, (n) => n >= 0 && n <= 100);
}

/** Sous ce ratio (cash / cash de référence), mode prudence (renfort / 2). Défaut 0,2. */
export function resolveCautionCashRatioThreshold(settings: InvestmentSettings): number {
  return pickNumber(settings, 'cautionCashRatioThreshold', 0.2, (n) => n > 0 && n <= 1);
}

/** Fenêtre « renfort similaire » (jours). Défaut 14. */
export function resolveReinforceCooldownDays(settings: InvestmentSettings): number {
  return pickNumber(settings, 'reinforceCooldownDays', 14, (n) => n >= 0 && n <= 365);
}

export function resolveReinforceCooldownMs(settings: InvestmentSettings): number {
  return Math.max(0, Math.trunc(resolveReinforceCooldownDays(settings))) * MS_PER_DAY;
}

/** Suppression suggestion palier (jours). Défaut 7. */
export function resolveSuggestionSuppressDays(settings: InvestmentSettings): number {
  return pickNumber(settings, 'suggestionSuppressDays', 7, (n) => n >= 1 && n <= 365);
}

export function resolveSuggestionSuppressMs(settings: InvestmentSettings): number {
  return Math.max(1, Math.trunc(resolveSuggestionSuppressDays(settings))) * MS_PER_DAY;
}

/** Delta drawdown (points) pour rouvrir une suggestion. Défaut 5. */
export function resolveSuggestionReopenDrawdownDelta(settings: InvestmentSettings): number {
  return pickNumber(settings, 'suggestionReopenDrawdownDelta', 5, (n) => n >= 0.5 && n <= 50);
}
