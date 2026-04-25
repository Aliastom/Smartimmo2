import type {
  InvestmentActionType,
  InvestmentRecommendation,
  InvestmentSettings,
  MarketOpportunityStatus,
  MarketSnapshot,
} from '@/features/market/types';

export function computeDrawdownPercent(currentPrice: number, athPrice: number): number {
  if (athPrice <= 0) return 0;
  return ((currentPrice - athPrice) / athPrice) * 100;
}

function normalizeThresholds(settings: Pick<InvestmentSettings, 'reinforce10Threshold' | 'reinforce20Threshold'>): {
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
  const { reinforce10Threshold, reinforce20Threshold } = normalizeThresholds(settings);
  if (drawdownPercent <= reinforce20Threshold) return 'FORTE_OPPORTUNITE';
  if (drawdownPercent <= reinforce10Threshold) return 'OPPORTUNITE';
  return 'NORMAL';
}

function getBaseAction(status: MarketOpportunityStatus): {
  actionType: InvestmentActionType;
  message: string;
} {
  if (status === 'FORTE_OPPORTUNITE') {
    return { actionType: 'REINFORCE_20', message: 'Renforcer fortement' };
  }
  if (status === 'OPPORTUNITE') {
    return { actionType: 'REINFORCE_10', message: 'Renforcer modérément' };
  }
  return { actionType: 'DCA', message: 'Investir le DCA prévu' };
}

export function buildThresholdKey(symbol: string, status: MarketOpportunityStatus): string | null {
  if (status === 'NORMAL') return null;
  return `${symbol}:${status}`;
}

export function computeRecommendation(
  settings: InvestmentSettings,
  snapshot: MarketSnapshot
): InvestmentRecommendation {
  const status = resolveMarketStatus(snapshot.drawdownPercent, settings);
  const baseAction = getBaseAction(status);

  let baseAmount = settings.monthlyDcaAmount;
  if (status !== 'NORMAL' && settings.strategy === 'DCA_PLUS_REINFORCE') {
    if (status === 'OPPORTUNITE') {
      baseAmount += settings.reinforce10Amount;
    } else if (status === 'FORTE_OPPORTUNITE') {
      baseAmount += settings.reinforce20Amount;
    }
  }

  const suggestedAmount =
    status === 'NORMAL' ? 0 : Math.max(0, Math.min(baseAmount, settings.availableCash));
  const cashLimited = status !== 'NORMAL' && baseAmount > settings.availableCash;
  const reason =
    status === 'NORMAL'
      ? `Drawdown ${snapshot.drawdownPercent.toFixed(1)}% sous ATH ${settings.athPeriod} — Le marché est proche de son plus haut de référence`
      : `Drawdown ${snapshot.drawdownPercent.toFixed(1)}% sous ATH ${settings.athPeriod} — ${baseAction.message}`;

  return {
    status,
    message: status === 'NORMAL' ? 'RAS marché' : baseAction.message,
    reason,
    suggestedAmount,
    baseAmount,
    cashLimited,
    actionType: baseAction.actionType,
    thresholdKey: buildThresholdKey(snapshot.symbol, status),
  };
}
