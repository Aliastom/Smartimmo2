import type { InvestmentActionLog } from '@/features/market/types';

interface ShouldSuppressSuggestionInput {
  latestDecision: InvestmentActionLog | null;
  currentDrawdownPercent: number;
  manualAnalysisAt: number | null;
  nowMs?: number;
}

export function shouldSuppressSuggestion(input: ShouldSuppressSuggestionInput): boolean {
  const now = input.nowMs ?? Date.now();
  if (!input.latestDecision) return false;

  const manualOverride = input.manualAnalysisAt !== null && now - input.manualAnalysisAt < 2 * 60 * 1000;
  if (manualOverride) return false;

  const ageMs = now - new Date(input.latestDecision.date).getTime();
  const olderThan7Days = ageMs > 7 * 24 * 60 * 60 * 1000;

  const latestDrawdown = input.latestDecision.drawdownAtDecision ?? input.latestDecision.drawdownPercentAtAction ?? 0;
  const aggravation = latestDrawdown - input.currentDrawdownPercent;
  const stronglyWorse = aggravation >= 5;

  return !(olderThan7Days || stronglyWorse);
}

