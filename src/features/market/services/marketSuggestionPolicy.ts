import type { InvestmentActionLog, InvestmentSettings } from '@/features/market/types';
import {
  resolveSuggestionReopenDrawdownDelta,
  resolveSuggestionSuppressMs,
} from '@/features/market/services/marketGuardrails';

interface ShouldSuppressSuggestionInput {
  latestDecision: InvestmentActionLog | null;
  currentDrawdownPercent: number;
  manualAnalysisAt: number | null;
  nowMs?: number;
  /** Paramètres marché (optionnel : défauts 7 j / 5 pts). */
  policySettings?: InvestmentSettings | null;
}

export function shouldSuppressSuggestion(input: ShouldSuppressSuggestionInput): boolean {
  const now = input.nowMs ?? Date.now();
  if (!input.latestDecision) return false;

  const manualOverride = input.manualAnalysisAt !== null && now - input.manualAnalysisAt < 2 * 60 * 1000;
  if (manualOverride) return false;

  const suppressMs =
    input.policySettings != null
      ? resolveSuggestionSuppressMs(input.policySettings)
      : 7 * 24 * 60 * 60 * 1000;
  const reopenDelta =
    input.policySettings != null
      ? resolveSuggestionReopenDrawdownDelta(input.policySettings)
      : 5;

  const ageMs = now - new Date(input.latestDecision.date).getTime();
  const olderThanWindow = ageMs > suppressMs;

  const latestDrawdown = input.latestDecision.drawdownAtDecision ?? input.latestDecision.drawdownPercentAtAction ?? 0;
  const aggravation = latestDrawdown - input.currentDrawdownPercent;
  const stronglyWorse = aggravation >= reopenDelta;

  return !(olderThanWindow || stronglyWorse);
}

