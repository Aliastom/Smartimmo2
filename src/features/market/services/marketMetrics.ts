import type { InvestmentSettings, MarketOpportunityStatus } from '@/features/market/types';

export function computeDrawdownPercent(currentPrice: number, athPrice: number): number {
  if (athPrice <= 0) return 0;
  return ((currentPrice - athPrice) / athPrice) * 100;
}

export function normalizeThresholds(settings: Pick<InvestmentSettings, 'reinforce10Threshold' | 'reinforce20Threshold'>): {
  reinforce10Threshold: number;
  reinforce20Threshold: number;
} {
  const raw10 = Number.isFinite(settings.reinforce10Threshold) ? settings.reinforce10Threshold : -10;
  const raw20 = Number.isFinite(settings.reinforce20Threshold) ? settings.reinforce20Threshold : -20;
  const reinforce10Threshold = Math.max(raw10, raw20);
  const reinforce20Threshold = Math.min(raw10, raw20);
  return { reinforce10Threshold, reinforce20Threshold };
}

export function resolveMarketStatus(
  drawdownPercent: number,
  settings: Pick<InvestmentSettings, 'reinforce10Threshold' | 'reinforce20Threshold'>
): MarketOpportunityStatus {
  if (!Number.isFinite(drawdownPercent)) return 'NORMAL';
  const { reinforce10Threshold, reinforce20Threshold } = normalizeThresholds(settings);
  if (drawdownPercent <= reinforce20Threshold) return 'FORTE_OPPORTUNITE';
  if (drawdownPercent <= reinforce10Threshold) return 'OPPORTUNITE';
  return 'NORMAL';
}
