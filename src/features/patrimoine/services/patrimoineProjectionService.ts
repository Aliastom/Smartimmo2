/**
 * Projections cash / patrimoine (indicatif) — pas de recalcul marché.
 */

export type PatrimoineProjectionTrend = 'croissance' | 'stagnation' | 'degradation';

export interface PatrimoineProjectionMonthPoint {
  monthIndex: number;
  cash: number;
  patrimoine: number;
  /** Sortie de trésorerie DCA ce mois */
  dcaDrain: number;
  /** Effort fiscal mensuel (provision) */
  fiscalDrain: number;
}

export interface PatrimoineProjectionInput {
  initialCash: number;
  initialPatrimoine: number;
  /** Capacité mensuelle nette locative (hors impôt provisionné si déjà dans netMonthlySurplus) */
  monthlyCapacity: number;
  /** Effort fiscal mensuel moyen (provision impôt) */
  monthlyFiscalEffort: number;
  /** Versement DCA mensuel hypothèse */
  monthlyDca: number;
  /** Rendement annuel hypothétique sur le patrimoine financier (ETF), simplifié */
  annualPatrimoineYield: number;
}

export interface PatrimoineProjectionResult {
  points: PatrimoineProjectionMonthPoint[];
  trend: PatrimoineProjectionTrend;
  /** Variation relative du patrimoine sur la fenêtre (ex. 0.08 = +8 %) */
  patrimoineDeltaRatio: number;
}

function classifyTrend(deltaRatio: number): PatrimoineProjectionTrend {
  if (deltaRatio > 0.02) return 'croissance';
  if (deltaRatio < -0.02) return 'degradation';
  return 'stagnation';
}

/**
 * Projection mensuelle simplifiée sur `years` années.
 * - Cash : évolution avec entrées nettes (capacity − fiscal − DCA).
 * - Patrimoine : croissance liée au rendement annuel lissé + entrées nettes réinvesties (approximation).
 */
function finiteNonNeg(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

/** Rendement annuel hypothétique borné pour éviter des projections aberrantes. */
function clampAnnualYield(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0.02;
  return Math.min(0.15, Math.max(0, raw));
}

export function computeCashflowProjection(input: PatrimoineProjectionInput, years: number = 5): PatrimoineProjectionResult {
  const months = Math.max(12, Math.min(600, Math.round(years * 12)));
  const annualYield = clampAnnualYield(input.annualPatrimoineYield);
  const monthlyYield = annualYield / 12;
  const cap = finiteNonNeg(input.monthlyCapacity);
  const fiscal = finiteNonNeg(input.monthlyFiscalEffort);
  const dca = finiteNonNeg(input.monthlyDca);
  const netSurplus = cap - fiscal - dca;

  let cash = finiteNonNeg(input.initialCash);
  let pat = finiteNonNeg(input.initialPatrimoine);

  const points: PatrimoineProjectionMonthPoint[] = [];
  const startPat = pat;

  for (let m = 0; m <= months; m++) {
    if (m > 0) {
      cash = Math.max(0, cash + netSurplus);
      pat = Math.max(0, pat * (1 + monthlyYield) + netSurplus * 0.5);
    }
    points.push({
      monthIndex: m,
      cash: Math.round(cash * 100) / 100,
      patrimoine: Math.round(pat * 100) / 100,
      dcaDrain: input.monthlyDca,
      fiscalDrain: input.monthlyFiscalEffort,
    });
  }

  const endPat = points[points.length - 1]?.patrimoine ?? pat;
  const patrimoineDeltaRatio = startPat > 0 ? (endPat - startPat) / startPat : 0;

  return {
    points,
    trend: classifyTrend(patrimoineDeltaRatio),
    patrimoineDeltaRatio: Math.round(patrimoineDeltaRatio * 1000) / 1000,
  };
}
