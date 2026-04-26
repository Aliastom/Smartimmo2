export type AthPeriod = '5Y' | '10Y' | 'MAX';
export type InvestmentEnvelope = 'PEA' | 'CTO' | 'ASSURANCE_VIE';
export type InvestmentStrategy = 'DCA_ONLY' | 'DCA_PLUS_REINFORCE';

/** Palier de renfort : seuil de drawdown (négatif) et % du cash à allouer au renfort */
export interface ReinforceLevelConfig {
  threshold: number;
  allocationPercent: number;
}

/** Stratégie progressive (DCA + paliers % du cash) — stockée dans les paramètres */
export interface InvestmentStrategyConfig {
  monthlyDca: number;
  reinforceLevels: ReinforceLevelConfig[];
}

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
  /**
   * PEA : taux de prélèvements sociaux appliqué sur les gains uniquement (ex. 0,172 = 17,2 %),
   * une fois l’exonération d’IR sur les gains acquise (modèle simplifié : horizons ≥ 5 ans).
   */
  peaSocialContributionsOnGainsRate?: number;
  /** V2 : DCA + paliers de % du cash (si absent, valeurs par défaut appliquées à la lecture) */
  investmentStrategy?: InvestmentStrategyConfig | null;
}

export interface MarketSnapshot {
  id: string;
  organizationId: string;
  symbol: string;
  athPeriod: AthPeriod;
  currentPrice: number;
  athPrice: number;
  drawdownPercent: number;
  athDate?: string | null;
  fetchedAt: string;
  source: string;
}

export type InvestmentActionType =
  | 'DCA'
  | 'REINFORCE_10'
  | 'REINFORCE_20'
  | 'REINFORCE_30'
  | 'REINFORCE_MAX'
  | 'MANUAL';
export type InvestmentActionStatus = 'suggested' | 'validated' | 'ignored';
export type MarketOpportunityStatus = 'NORMAL' | 'OPPORTUNITE' | 'FORTE_OPPORTUNITE';

/** Type de suggestion V2 (moteur décisionnel) */
export type InvestmentDecisionType = 'DCA_ONLY' | 'LIGHT_REINFORCE' | 'MEDIUM_REINFORCE' | 'STRONG_REINFORCE';

/** Libellés sémantiques UX (score numérique inchangé) */
export type MarketScoreLabel = 'MARCHÉ HAUT' | 'MARCHÉ NEUTRE' | 'OPPORTUNITÉ';

export type DecisionConfidenceLevel = 'low' | 'medium' | 'high';

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
  /** Présent si la décision validée a été modifiée après coup (local-first). */
  updatedAt?: string | null;
}

export interface InvestmentRecommendation {
  status: MarketOpportunityStatus;
  /** Moteur V2 : type de suggestion (palier renfort) */
  decisionType: InvestmentDecisionType;
  /** Score marché 0–100 (haut = marché cher vs ATH) */
  score: number;
  marketScoreLabel: MarketScoreLabel;
  message: string;
  reason: string;
  suggestedAmount: number;
  /** Part DCA dans la suggestion totale */
  monthlyDcaPortion: number;
  /** Part renfort (hors DCA) avant plafond cash */
  reinforcePortion: number;
  baseAmount: number;
  cashLimited: boolean;
  actionType: InvestmentActionType;
  thresholdKey: string | null;
  confidenceLevel: DecisionConfidenceLevel;
  /** Mode prudence : cash restant sous 20 % du cash initial de référence */
  prudenceMode: boolean;
  /** Renfort similaire récent : montant renfort réduit */
  recentSimilarReinforce: boolean;
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
