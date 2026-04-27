import type {
  DecisionConfidenceLevel,
  InvestmentActionLog,
  InvestmentActionType,
  InvestmentDecisionType,
  InvestmentRecommendation,
  InvestmentSettings,
  MarketOpportunityStatus,
  MarketScoreLabel,
  MarketSnapshot,
} from '@/features/market/types';
import {
  getEffectiveInvestmentStrategy,
  normalizeReinforceLevels,
  pickActiveReinforceLevel,
} from '@/features/market/services/marketInvestmentStrategy';
import { normalizeThresholds } from '@/features/market/services/marketMetrics';

const SCORE_ANCHORS: Array<{ dd: number; score: number }> = [
  { dd: -40, score: 10 },
  { dd: -30, score: 20 },
  { dd: -20, score: 40 },
  { dd: -10, score: 60 },
  { dd: 0, score: 95 },
];

const RECENT_REINFORCE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export function computeMarketScore(snapshot: Pick<MarketSnapshot, 'drawdownPercent'>): {
  score: number;
  label: MarketScoreLabel;
} {
  const dd = snapshot.drawdownPercent;
  if (!Number.isFinite(dd)) {
    return { score: 50, label: 'MARCHÉ NEUTRE' };
  }
  if (dd <= SCORE_ANCHORS[0].dd) {
    return { score: SCORE_ANCHORS[0].score, label: scoreToLabel(SCORE_ANCHORS[0].score) };
  }
  if (dd >= SCORE_ANCHORS[SCORE_ANCHORS.length - 1].dd) {
    const s = SCORE_ANCHORS[SCORE_ANCHORS.length - 1].score;
    return { score: s, label: scoreToLabel(s) };
  }
  for (let i = 0; i < SCORE_ANCHORS.length - 1; i++) {
    const left = SCORE_ANCHORS[i];
    const right = SCORE_ANCHORS[i + 1];
    if (dd >= left.dd && dd <= right.dd) {
      const t = (dd - left.dd) / (right.dd - left.dd);
      const score = Math.round(left.score + t * (right.score - left.score));
      const clamped = Math.max(0, Math.min(100, score));
      return { score: clamped, label: scoreToLabel(clamped) };
    }
  }
  return { score: 50, label: 'MARCHÉ NEUTRE' };
}

function scoreToLabel(score: number): MarketScoreLabel {
  if (score > 70) return 'MARCHÉ HAUT';
  if (score >= 40) return 'MARCHÉ NEUTRE';
  return 'OPPORTUNITÉ';
}

/**
 * Type de décision à partir du drawdown et des seuils paramétrables (reinforce10/20)
 * + frontière tertiaire dérivée des paliers % cash (premier seuil strictement sous le seuil « forte »).
 */
export function resolveDecisionTypeFromDrawdown(settings: InvestmentSettings, drawdownPercent: number): InvestmentDecisionType {
  const { reinforce10Threshold: t10, reinforce20Threshold: t20 } = normalizeThresholds(settings);
  if (drawdownPercent > t10) return 'DCA_ONLY';
  const strategy = getEffectiveInvestmentStrategy(settings);
  const levelThresholds = normalizeReinforceLevels(strategy.reinforceLevels).map((l) => l.threshold);
  const deeper = levelThresholds.filter((t) => t < t20);
  let t30 = deeper.length > 0 ? Math.max(...deeper) : t20 - 10;
  if (!(t30 < t20)) {
    t30 = t20 - 1e-6;
  }
  if (drawdownPercent > t20) return 'LIGHT_REINFORCE';
  if (drawdownPercent > t30) return 'MEDIUM_REINFORCE';
  return 'STRONG_REINFORCE';
}

function marketStatusFromDecisionType(decisionType: InvestmentDecisionType): MarketOpportunityStatus {
  if (decisionType === 'DCA_ONLY') return 'NORMAL';
  if (decisionType === 'LIGHT_REINFORCE') return 'OPPORTUNITE';
  return 'FORTE_OPPORTUNITE';
}

function actionTypeFromDecision(
  decisionType: InvestmentDecisionType,
  activeLevelAllocation: number
): InvestmentActionType {
  if (decisionType === 'DCA_ONLY') return 'DCA';
  if (decisionType === 'LIGHT_REINFORCE') return 'REINFORCE_10';
  if (decisionType === 'MEDIUM_REINFORCE') return 'REINFORCE_20';
  if (activeLevelAllocation >= 40) return 'REINFORCE_MAX';
  return 'REINFORCE_30';
}

function buildThresholdKey(symbol: string, decisionType: InvestmentDecisionType): string | null {
  if (decisionType === 'DCA_ONLY') return null;
  return `${symbol}:${decisionType}`;
}

function hasRecentSameLevelReinforce(
  history: InvestmentActionLog[],
  symbol: string,
  decisionType: InvestmentDecisionType,
  nowMs: number
): boolean {
  if (decisionType === 'DCA_ONLY') return false;
  const key = buildThresholdKey(symbol, decisionType);
  if (!key) return false;
  const cutoff = nowMs - RECENT_REINFORCE_WINDOW_MS;
  return history.some((row) => {
    if (row.status !== 'validated') return false;
    if (row.symbolAtDecision !== symbol) return false;
    const t = new Date(row.date).getTime();
    if (!Number.isFinite(t) || t < cutoff) return false;
    return row.thresholdKey === key;
  });
}

function confidenceFrom(
  decisionType: InvestmentDecisionType,
  prudenceMode: boolean,
  recentSimilar: boolean
): DecisionConfidenceLevel {
  if (prudenceMode || recentSimilar) return 'low';
  if (decisionType === 'STRONG_REINFORCE') return 'high';
  if (decisionType === 'MEDIUM_REINFORCE' || decisionType === 'LIGHT_REINFORCE') return 'medium';
  return 'high';
}

export function computeInvestmentRecommendation(
  settings: InvestmentSettings,
  snapshot: MarketSnapshot,
  history: InvestmentActionLog[],
  options?: { nowMs?: number }
): InvestmentRecommendation {
  const nowMs = options?.nowMs ?? Date.now();
  const strategy = getEffectiveInvestmentStrategy(settings);
  const dca = Math.max(0, settings.monthlyDcaAmount);
  const cash = Math.max(0, settings.availableCash);
  const cashRef = Math.max(0, settings.cashReferenceAmount || cash || 1);
  const prudenceMode = cash / cashRef < 0.2;
  const dd = snapshot.drawdownPercent;

  if (!Number.isFinite(dd)) {
    const decisionType: InvestmentDecisionType = 'DCA_ONLY';
    const monthlyDcaPortion = Math.min(dca, cash);
    const suggestedAmount = Math.round(monthlyDcaPortion * 100) / 100;
    const { score, label: marketScoreLabel } = computeMarketScore(snapshot);
    return {
      status: 'NORMAL',
      decisionType,
      score,
      marketScoreLabel,
      message: 'Continuer le DCA',
      reason:
        'Drawdown indisponible ou non numérique — suggestion limitée au DCA mensuel, sans renfort.',
      suggestedAmount,
      monthlyDcaPortion: suggestedAmount,
      reinforcePortion: 0,
      baseAmount: suggestedAmount,
      cashLimited: false,
      actionType: 'DCA',
      thresholdKey: null,
      confidenceLevel: 'low',
      prudenceMode,
      recentSimilarReinforce: false,
      insufficientMarketData: true,
    };
  }

  let decisionType = resolveDecisionTypeFromDrawdown(settings, dd);
  if (settings.strategy === 'DCA_ONLY') {
    decisionType = 'DCA_ONLY';
  }
  const status = marketStatusFromDecisionType(decisionType);
  const { score, label: marketScoreLabel } = computeMarketScore(snapshot);

  const activeLevel =
    settings.strategy === 'DCA_PLUS_REINFORCE' && decisionType !== 'DCA_ONLY'
      ? pickActiveReinforceLevel(dd, strategy.reinforceLevels)
      : null;

  let reinforcePortion =
    activeLevel && settings.strategy === 'DCA_PLUS_REINFORCE'
      ? (cash * Math.min(100, Math.max(0, activeLevel.allocationPercent))) / 100
      : 0;

  const recentSimilar = hasRecentSameLevelReinforce(history, snapshot.symbol, decisionType, nowMs);
  if (recentSimilar && reinforcePortion > 0) {
    reinforcePortion *= 0.5;
  }
  if (prudenceMode && reinforcePortion > 0) {
    reinforcePortion *= 0.5;
  }

  const monthlyDcaPortion = Math.min(dca, cash);
  let suggestedAmount = Math.min(cash, monthlyDcaPortion + reinforcePortion);
  const baseBeforeCap = monthlyDcaPortion + reinforcePortion;
  const cashLimited = baseBeforeCap > cash + 1e-6;

  const actionType = actionTypeFromDecision(decisionType, activeLevel?.allocationPercent ?? 0);
  const thresholdKey = buildThresholdKey(snapshot.symbol, decisionType);

  const reasonParts = [
    `Drawdown ${dd.toFixed(2)}% vs ATH ${settings.athPeriod}`,
    decisionType === 'DCA_ONLY'
      ? 'Stratégie : DCA mensuel uniquement (marché proche des hauts)'
      : `Renfort progressif : ${activeLevel ? `${activeLevel.allocationPercent}% du cash disponible` : '—'}`,
  ];
  if (prudenceMode) reasonParts.push('Mode prudence : cash restant faible vs référence initiale');
  if (recentSimilar) reasonParts.push('Renfort similaire récemment enregistré : renfort divisé par 2');

  const message =
    decisionType === 'DCA_ONLY'
      ? 'Continuer le DCA'
      : activeLevel
        ? `Renfort (${activeLevel.allocationPercent}% du cash) + DCA`
        : 'Renfort + DCA';

  return {
    status,
    decisionType,
    score,
    marketScoreLabel,
    message,
    reason: reasonParts.join(' — '),
    suggestedAmount: Math.round(suggestedAmount * 100) / 100,
    monthlyDcaPortion: Math.round(monthlyDcaPortion * 100) / 100,
    reinforcePortion: Math.round(reinforcePortion * 100) / 100,
    baseAmount: Math.round(baseBeforeCap * 100) / 100,
    cashLimited,
    actionType,
    thresholdKey,
    confidenceLevel: confidenceFrom(decisionType, prudenceMode, recentSimilar),
    prudenceMode,
    recentSimilarReinforce: recentSimilar,
  };
}

const PEDAGOGICAL_IMPORTANT_BLOCK =
  'Important :\n' +
  'Le marché passe une grande partie du temps proche de ses plus hauts.\n' +
  'Attendre une baisse peut réduire la performance à long terme.';

export interface DecisionMessagePayload {
  headline: string;
  strategyBlock: string;
  amountLine: string;
  whyBullets: string[];
  /** Bloc pédagogique récurrent (affichage UX) */
  importantBlock: string;
}

export function generateDecisionMessage(
  rec: InvestmentRecommendation,
  snapshot: MarketSnapshot,
  settings: InvestmentSettings
): DecisionMessagePayload {
  const dd = snapshot.drawdownPercent;
  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: settings.currency, maximumFractionDigits: 0 }).format(
      n
    );

  if (rec.insufficientMarketData) {
    return {
      headline: 'Données de marché insuffisantes',
      strategyBlock:
        'Le drawdown n’a pas pu être évalué correctement.\nStratégie recommandée :\nContinuer uniquement le DCA mensuel, sans renfort automatique.',
      amountLine: `Montant indicatif (DCA mensuel) : ${fmt(rec.monthlyDcaPortion)}.`,
      whyBullets: [
        'Sans niveau de baisse fiable par rapport au sommet, aucun renfort n’est proposé.',
        'Actualisez les données marché ou vérifiez les prix saisis.',
        'Le DCA régulier reste la base la plus prudente dans ce cas.',
      ],
      importantBlock: PEDAGOGICAL_IMPORTANT_BLOCK,
    };
  }

  if (rec.decisionType === 'DCA_ONLY') {
    return {
      headline: 'Marché proche de ses plus hauts',
      strategyBlock:
        'Stratégie recommandée :\nContinuer le DCA uniquement.',
      amountLine: `Montant indicatif (DCA mensuel) : ${fmt(rec.monthlyDcaPortion)}.`,
      whyBullets: [
        'Drawdown limité : les corrections profondes ne sont ni garanties ni prévisibles.',
        'Sur le long terme, la régularité du DCA compense souvent le timing.',
        'Ne pas suspendre le DCA en attendant une baisse hypothétique.',
      ],
      importantBlock: PEDAGOGICAL_IMPORTANT_BLOCK,
    };
  }

  const depthLabel =
    rec.decisionType === 'LIGHT_REINFORCE'
      ? 'baisse modérée'
      : rec.decisionType === 'MEDIUM_REINFORCE'
        ? 'correction marquée'
        : 'forte baisse';

  const ddLabel = Number.isFinite(dd) ? `${dd.toFixed(0)}%` : '—';
  const headline =
    rec.score > 80
      ? 'Marché proche de ses plus hauts'
      : rec.decisionType === 'STRONG_REINFORCE'
        ? `Marché en forte baisse (${ddLabel}).`
        : `Marché en ${depthLabel} (${ddLabel}).`;

  const oppWord =
    rec.decisionType === 'STRONG_REINFORCE' ? 'Opportunité rare' : 'Opportunité intéressante';

  const strategyBlock = `${oppWord}.\nStratégie recommandée :\nInvestir ${fmt(rec.suggestedAmount)} (DCA + renfort progressif).`;

  const amountLine =
    rec.decisionType === 'STRONG_REINFORCE'
      ? `Suggestion : investir fortement (${fmt(rec.suggestedAmount)}), dans la limite de votre cash et de votre profil de risque.`
      : `Suggestion : investir ${fmt(rec.suggestedAmount)}.`;

  const whyBullets: string[] = [
    'Niveau de correction significatif par rapport au plus haut de référence.',
    'Historiquement, les phases de stress peuvent être favorables à l’investisseur patient.',
    'Votre cash disponible permet d’appliquer la stratégie progressive sans dépasser le restant.',
  ];
  if (rec.prudenceMode) {
    whyBullets.push('Mode prudence : votre cash restant est faible par rapport au montant initial — les renforts sont atténués.');
  }
  if (rec.recentSimilarReinforce) {
    whyBullets.push('Un renfort sur un palier proche a déjà été enregistré récemment : le renfort est réduit pour éviter de sur-investir trop vite.');
  }

  return {
    headline,
    strategyBlock,
    amountLine,
    whyBullets,
    importantBlock: PEDAGOGICAL_IMPORTANT_BLOCK,
  };
}
