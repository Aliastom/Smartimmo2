export type AthPeriod = '5Y' | '10Y' | 'MAX';
export type InvestmentEnvelope = 'PEA' | 'CTO' | 'ASSURANCE_VIE';
export type InvestmentStrategy = 'DCA_ONLY' | 'DCA_PLUS_REINFORCE';

export interface InvestmentSettings {
  id: string;
  organizationId: string;
  referenceSymbol: string;
  referenceLabel: string;
  envelope: InvestmentEnvelope;
  athPeriod: AthPeriod;
  availableCash: number;
  monthlyDcaAmount: number;
  reinforce10Threshold: number;
  reinforce20Threshold: number;
  reinforce10Amount: number;
  reinforce20Amount: number;
  strategy: InvestmentStrategy;
  cashReferenceAmount: number;
  currency: string;
  updatedAt: string;
}

export interface MarketSnapshot {
  id: string;
  organizationId: string;
  symbol: string;
  currentPrice: number;
  athPrice: number;
  drawdownPercent: number;
  athDate?: string | null;
  fetchedAt: string;
  source: string;
}

export type InvestmentActionType = 'DCA' | 'REINFORCE_10' | 'REINFORCE_20' | 'MANUAL';
export type InvestmentActionStatus = 'suggested' | 'validated' | 'ignored';
export type MarketOpportunityStatus = 'NORMAL' | 'OPPORTUNITE' | 'FORTE_OPPORTUNITE';

export interface InvestmentActionLog {
  id: string;
  organizationId: string;
  date: string;
  type: InvestmentActionType;
  recommendedAmount: number;
  validatedAmount: number;
  cashBefore: number;
  cashAfter: number;
  reason: string;
  drawdownAtDecision: number;
  athPriceAtDecision: number;
  currentPriceAtDecision: number;
  symbolAtDecision: string;
  marketStatusAtDecision: MarketOpportunityStatus;
  athPeriodAtDecision: AthPeriod;
  status: InvestmentActionStatus;
  note?: string | null;
  thresholdKey?: string | null;
  marketLevelKey?: string | null;
  drawdownPercentAtAction?: number | null; // compat legacy
}

export interface InvestmentRecommendation {
  status: MarketOpportunityStatus;
  message: string;
  reason: string;
  suggestedAmount: number;
  baseAmount: number;
  cashLimited: boolean;
  actionType: InvestmentActionType;
  thresholdKey: string | null;
}

export interface MarketAlert {
  id: string;
  organizationId: string;
  symbol: string;
  level: Exclude<MarketOpportunityStatus, 'NORMAL'>;
  message: string;
  drawdownPercent: number;
  createdAt: string;
  readAt?: string | null;
}
