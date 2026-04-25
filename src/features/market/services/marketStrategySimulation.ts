/**
 * Simulation pédagogique locale (aucune API) — hypothèses fixes et simplifiées.
 * Ne constitue pas un conseil en investissement ni une projection contractuelle.
 */

export const STRATEGY_SIM_YEARS = 5;
export const STRATEGY_SIM_ANNUAL_RETURN = 0.07;
/** Fourchette : borne basse = estimatedValue × 0.9, haute = × 1.1 */
export const STRATEGY_SIM_LOW_FACTOR = 0.9;
export const STRATEGY_SIM_HIGH_FACTOR = 1.1;
/** Mois d’attente hors marché avant investissement du lump sum (stratégie « attendre ») */
export const STRATEGY_SIM_WAIT_MONTHS = 6;

export type StrategySimId = 'dca' | 'lump' | 'wait';

export interface StrategySimLine {
  id: StrategySimId;
  /** Valeur centrale fin de période (scénario simplifié) */
  estimatedValue: number;
  /** Borne basse indicative */
  lowEstimate: number;
  /** Borne haute indicative */
  highEstimate: number;
}

export interface StrategySimulationResult {
  horizonYears: number;
  annualReturnAssumption: number;
  waitMonths: number;
  lines: StrategySimLine[];
  /** Meilleur scénario central au sens strictement chiffré (hypothèses fixes) */
  bestNumericId: StrategySimId;
}

function monthlyRateFromAnnual(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}

/** Valeur future d’une annuité en début de période, n versements de P, taux mensuel r */
function futureValueAnnuityImmediate(P: number, r: number, n: number): number {
  if (n <= 0) return 0;
  if (Math.abs(r) < 1e-12) return P * n;
  return (P * (Math.pow(1 + r, n) - 1)) / r;
}

/** Lump sum investi dès le mois `startMonth` (0 = maintenant), capitalisé jusqu’à `totalMonths` */
function futureValueLumpFromMonth(lump: number, r: number, totalMonths: number, startMonth: number): number {
  if (lump <= 0) return 0;
  const investMonths = Math.max(0, totalMonths - startMonth);
  if (investMonths <= 0) return lump;
  return lump * Math.pow(1 + r, investMonths);
}

function roundMoney(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.round(v);
}

function buildLine(id: StrategySimId, rawMid: number): StrategySimLine {
  const estimatedValue = roundMoney(rawMid);
  const lowRaw = estimatedValue * STRATEGY_SIM_LOW_FACTOR;
  const highRaw = estimatedValue * STRATEGY_SIM_HIGH_FACTOR;
  const lowEstimate = roundMoney(lowRaw);
  const highEstimate = roundMoney(highRaw);
  return {
    id,
    estimatedValue: Number.isFinite(estimatedValue) ? estimatedValue : 0,
    lowEstimate: Number.isFinite(lowEstimate) ? lowEstimate : 0,
    highEstimate: Number.isFinite(highEstimate) ? highEstimate : 0,
  };
}

/**
 * Compare 3 stratégies sur 5 ans :
 * - DCA : versements mensuels constants
 * - Lump sum : tout investi aujourd’hui
 * - Attente : 6 mois hors marché puis investissement du lump sum (illustration « attendre une baisse » simplifiée)
 */
export function computeStrategySimulation(input: {
  monthlyDca: number;
  lumpSumCash: number;
}): StrategySimulationResult {
  const horizonYears = STRATEGY_SIM_YEARS;
  const totalMonths = horizonYears * 12;
  const r = monthlyRateFromAnnual(STRATEGY_SIM_ANNUAL_RETURN);
  const waitM = STRATEGY_SIM_WAIT_MONTHS;

  const dcaMid = futureValueAnnuityImmediate(Math.max(0, input.monthlyDca), r, totalMonths);
  const lumpMid = futureValueLumpFromMonth(Math.max(0, input.lumpSumCash), r, totalMonths, 0);
  const waitMid = futureValueLumpFromMonth(Math.max(0, input.lumpSumCash), r, totalMonths, waitM);

  const lines: StrategySimLine[] = [
    buildLine('dca', dcaMid),
    buildLine('lump', lumpMid),
    buildLine('wait', waitMid),
  ];

  const bestNumericId = lines.reduce((best, cur) => (cur.estimatedValue > best.estimatedValue ? cur : best)).id;

  return {
    horizonYears,
    annualReturnAssumption: STRATEGY_SIM_ANNUAL_RETURN,
    waitMonths: waitM,
    lines,
    bestNumericId,
  };
}
