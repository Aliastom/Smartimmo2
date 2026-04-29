/**
 * Recommandations agrégées Patrimoine — s’appuie sur les sorties du moteur marché existant
 * (InvestmentRecommendation) sans recalculer drawdown / score marché.
 */

import type {
  InvestmentDecisionType,
  InvestmentRecommendation,
  MarketOpportunityStatus,
  MarketScoreLabel,
} from '@/features/market/types';
import type { PatrimoineObjective } from '@/features/patrimoine/store/patrimoineSettings';

export type PatrimoinePrimaryAction = 'DCA' | 'REINFORCE' | 'WAIT';

export type PatrimoineRecoLevel = 'INFO' | 'WARNING' | 'OPPORTUNITY';

export interface PatrimoineDecisionInput {
  drawdownPercent: number | null;
  athDistancePercent: number | null;
  scoreAllocation: number;
  allocationEtf: number;
  allocationImmo: number;
  cashExcess: number;
  investableCash: number;
  patrimoineNetGlobal: number;
  marketMonthlyDcaPortion: number;
  marketReinforcePortion: number;
  marketSuggestedTotal: number;
  marketScore: number | null;
  marketScoreLabel: MarketScoreLabel | null;
  marketStatus: MarketOpportunityStatus | null;
  marketDecisionType: InvestmentDecisionType | null;
  insufficientMarketData: boolean;
  isNearAthMarket: boolean;
  objective: PatrimoineObjective;
}

export interface PatrimoineRecommendationResult {
  primaryAction: PatrimoinePrimaryAction;
  dcaAmount: number;
  reinforceAmount: number;
  message: string;
  level: PatrimoineRecoLevel;
}

const NEAR_ATH_DRAWDOWN_FLOOR = -8;

function isNearAthFromDrawdown(dd: number | null): boolean {
  if (dd == null || !Number.isFinite(dd)) return false;
  return dd > NEAR_ATH_DRAWDOWN_FLOOR;
}

function reinforceInvestableThreshold(objective: PatrimoineObjective): number {
  if (objective === 'croissance') return 2000;
  if (objective === 'securite') return 5000;
  return 3000;
}

function reinforceFraction(objective: PatrimoineObjective): number {
  if (objective === 'securite') return 0.2;
  return 0.3;
}

export function computePatrimoineRecommendation(input: PatrimoineDecisionInput): PatrimoineRecommendationResult {
  const dd = input.drawdownPercent;
  const investable = Math.max(0, input.investableCash);
  const dcaFromMarket = Math.max(0, input.marketMonthlyDcaPortion);
  const reinforceFromMarket = Math.max(0, input.marketReinforcePortion);
  const thr = reinforceInvestableThreshold(input.objective);
  const frac = reinforceFraction(input.objective);

  const reinforceRule =
    Number.isFinite(dd as number) &&
    (dd as number) >= -15 &&
    (dd as number) <= 0 &&
    investable > thr &&
    input.objective !== 'securite';

  const reinforceRuleSec =
    input.objective === 'securite' &&
    Number.isFinite(dd as number) &&
    (dd as number) >= -15 &&
    (dd as number) <= -8 &&
    investable > thr;

  if (reinforceRule || reinforceRuleSec) {
    const reinforceAmount = Math.round(investable * frac * 100) / 100;
    return {
      primaryAction: 'REINFORCE',
      dcaAmount: dcaFromMarket,
      reinforceAmount,
      message:
        input.objective === 'croissance'
          ? 'Une opportunité apparaît — accent sur les versements progressifs et renfort ciblé.'
          : 'Une opportunité apparaît — renfort conseillé sur une partie du cash investissable.',
      level: 'OPPORTUNITY',
    };
  }

  const nearAth =
    input.isNearAthMarket ||
    input.marketScoreLabel === 'MARCHÉ HAUT' ||
    (input.marketScore != null && input.marketScore > 70) ||
    isNearAthFromDrawdown(dd);

  if (nearAth && !input.insufficientMarketData) {
    return {
      primaryAction: 'DCA',
      dcaAmount: dcaFromMarket,
      reinforceAmount: 0,
      message:
        input.objective === 'croissance'
          ? 'Le marché est élevé — reste discipliné sur le DCA pour capter la croissance long terme.'
          : 'Le marché est élevé — privilégier le DCA progressif plutôt qu’un gros ticket.',
      level: 'INFO',
    };
  }

  const opportunityMarket =
    input.marketStatus === 'OPPORTUNITE' ||
    input.marketStatus === 'FORTE_OPPORTUNITE' ||
    input.marketScoreLabel === 'OPPORTUNITÉ';

  const reinforceMarketAmount =
    input.objective === 'securite' ? reinforceFromMarket * 0.65 : reinforceFromMarket;

  if (opportunityMarket && reinforceMarketAmount > 0 && input.objective !== 'securite') {
    return {
      primaryAction: 'REINFORCE',
      dcaAmount: dcaFromMarket,
      reinforceAmount: Math.round(reinforceMarketAmount * 100) / 100,
      message: 'Le marché offre une fenêtre — renfort aligné sur la suggestion marché.',
      level: 'OPPORTUNITY',
    };
  }

  if (input.cashExcess > 5000) {
    return {
      primaryAction: 'WAIT',
      dcaAmount: dcaFromMarket,
      reinforceAmount: 0,
      message:
        input.objective === 'securite'
          ? 'Excès de cash : renforce la trésorerie de précaution ou cadre un plan d’enveloppes.'
          : 'Trop de cash dormeur — définis un plan DCA ou un renfort ciblé.',
      level: 'WARNING',
    };
  }

  if (input.allocationImmo > 0.65 && input.patrimoineNetGlobal > 0) {
    return {
      primaryAction: 'WAIT',
      dcaAmount: dcaFromMarket,
      reinforceAmount: 0,
      message: 'Ton patrimoine est trop concentré en immobilier.',
      level: 'WARNING',
    };
  }

  if (input.allocationEtf < 0.2 && input.patrimoineNetGlobal > 0) {
    return {
      primaryAction: 'WAIT',
      dcaAmount: dcaFromMarket,
      reinforceAmount: 0,
      message:
        input.objective === 'croissance'
          ? 'Exposition ETF faible : augmente progressivement les versements pour diversifier.'
          : 'Ton exposition ETF est faible — diversifie progressivement hors immobilier.',
      level: 'WARNING',
    };
  }

  return {
    primaryAction: 'WAIT',
    dcaAmount: dcaFromMarket,
    reinforceAmount: 0,
    message: 'Rien d’urgent : maintiens ta discipline et surveille le marché.',
    level: 'INFO',
  };
}

export function buildPatrimoineDecisionInput(params: {
  marketRecommendation: InvestmentRecommendation | null;
  drawdownPercent: number | null;
  athDistancePercent: number | null;
  scoreAllocation: number;
  allocationEtf: number;
  allocationImmo: number;
  cashExcess: number;
  investableCash: number;
  patrimoineNetGlobal: number;
  marketMonthlyDcaPortion: number;
  marketReinforcePortion: number;
  marketSuggestedTotal: number;
  objective: PatrimoineObjective;
}): PatrimoineDecisionInput {
  const rec = params.marketRecommendation;
  return {
    drawdownPercent: params.drawdownPercent,
    athDistancePercent: params.athDistancePercent,
    scoreAllocation: params.scoreAllocation,
    allocationEtf: params.allocationEtf,
    allocationImmo: params.allocationImmo,
    cashExcess: params.cashExcess,
    investableCash: params.investableCash,
    patrimoineNetGlobal: params.patrimoineNetGlobal,
    marketMonthlyDcaPortion: params.marketMonthlyDcaPortion,
    marketReinforcePortion: params.marketReinforcePortion,
    marketSuggestedTotal: params.marketSuggestedTotal,
    marketScore: rec?.score ?? null,
    marketScoreLabel: rec?.marketScoreLabel ?? null,
    marketStatus: rec?.status ?? null,
    marketDecisionType: rec?.decisionType ?? null,
    insufficientMarketData: Boolean(rec?.insufficientMarketData),
    isNearAthMarket: Boolean(rec && rec.decisionType === 'DCA_ONLY' && !rec.insufficientMarketData),
    objective: params.objective,
  };
}

/** Actions ordonnées pour le plan cockpit V3 */
export type PriorityActionType = 'DCA' | 'REINFORCE' | 'OPTIMIZE_FISCAL' | 'REDUCE_CASH';

export interface PriorityActionItem {
  type: PriorityActionType;
  priority: number;
  label: string;
  amount?: number;
}

export interface PriorityActionsInput {
  objective: PatrimoineObjective;
  dcaMonthlyAmount: number;
  reinforceSuggested: number;
  drawdownPercent: number | null;
  investableCash: number;
  fiscalResteAPayer: number | null;
  fiscalEffortMensuel: number | null;
  cashExcess: number;
  cashSecurite: number;
}

function roundEuro(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computePriorityActions(input: PriorityActionsInput): PriorityActionItem[] {
  const dd = input.drawdownPercent;
  const hasDd = dd != null && Number.isFinite(dd);
  const oppDrawdown = hasDd && dd <= -5 && input.investableCash > 1500;
  const dcaAmt = roundEuro(Math.max(0, input.dcaMonthlyAmount));
  const reinAmt = roundEuro(Math.max(0, input.reinforceSuggested));
  const fiscalEffort = input.fiscalEffortMensuel != null ? roundEuro(Math.max(0, input.fiscalEffortMensuel)) : null;
  const reste = input.fiscalResteAPayer != null ? roundEuro(Math.max(0, input.fiscalResteAPayer)) : null;

  type Cand = { type: PriorityActionType; score: number; label: string; amount?: number };

  const cands: Cand[] = [];

  cands.push({
    type: 'DCA',
    score: input.objective === 'croissance' ? 95 : 80,
    label: `Investir ${dcaAmt.toLocaleString('fr-FR')} €/mois (DCA)`,
    amount: dcaAmt,
  });

  const reinforceLabel =
    hasDd && dd <= -10
      ? `Prévoir renfort ${reinAmt.toLocaleString('fr-FR')} € si le marché reste sous −10 %`
      : `Prévoir renfort ${reinAmt.toLocaleString('fr-FR')} € si le marché se dégrade`;

  cands.push({
    type: 'REINFORCE',
    score:
      oppDrawdown && input.objective !== 'securite'
        ? 92
        : input.objective === 'securite'
          ? 40
          : 75,
    label: reinforceLabel,
    amount: reinAmt,
  });

  if (fiscalEffort != null && fiscalEffort > 0) {
    const highFiscal = reste != null && reste > 3000;
    cands.push({
      type: 'OPTIMIZE_FISCAL',
      score: highFiscal ? 88 : 65,
      label:
        reste != null && reste > 0
          ? `Mettre de côté ${fiscalEffort.toLocaleString('fr-FR')} €/mois pour l’impôt (reste estimé ${reste.toLocaleString('fr-FR')} €)`
          : `Anticipation fiscale : ${fiscalEffort.toLocaleString('fr-FR')} €/mois`,
      amount: fiscalEffort,
    });
  } else {
    cands.push({
      type: 'OPTIMIZE_FISCAL',
      score: 30,
      label: 'Optimiser la fiscalité (complète une simulation à jour)',
    });
  }

  const cashHeavy = input.cashExcess > input.cashSecurite;
  cands.push({
    type: 'REDUCE_CASH',
    score: cashHeavy && input.objective !== 'croissance' ? 85 : cashHeavy ? 70 : 45,
    label: 'Réduire le cash dormant en l’allouant au plan DCA ou au PEA',
    amount: roundEuro(Math.max(0, input.cashExcess)),
  });

  cands.sort((a, b) => b.score - a.score);

  return cands.map((c, i) => ({
    type: c.type,
    priority: i + 1,
    label: c.label,
    amount: c.amount,
  }));
}
