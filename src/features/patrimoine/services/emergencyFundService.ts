/**
 * Épargne de sécurité recommandée : 3 à 6 mois de revenu net mensuel.
 * Les montants annuels sont alignés sur le KPI Patrimoine (revenu net annuel prioritaire via agrégat fiscal + ETF).
 */

import type { InvestmentRecommendation } from '@/features/market/types';

const MONTHS_MIN = 3;
const MONTHS_TARGET = 6;

/** Revenu annuel indétectable ou négligeable — pas de ratio mois fiable */
const MIN_ANNUAL_NET = 1;

export type EmergencyFundStatus = 'CRITIQUE' | 'A_RENFORCER' | 'CONFORTABLE';

export type EmergencyFundIncomeSource =
  | 'REVENU_GLOBAL_ESTIME'
  | 'LOCATIF_NET_SEUL'
  | 'INDISPONIBLE';

export interface EmergencyFundInput {
  /** Cash disponible cockpit (aligné snapshot Patrimoine) */
  currentCash: number;
  /**
   * Revenu net annuel prioritaire — typiquement `revenuGlobalEstime` (simulation fiscale + rendement ETF hypothèse).
   */
  revenuGlobalEstime: number;
  /** Revenu locatif net annuel issu fiscal (fallback si agrégat global nul) */
  revenuLocatifNetAnnual: number;
  /** True si une simulation fiscale exploitable est présente (priorise le fallback locatif) */
  hasFiscalSimulation: boolean;
}

export interface EmergencyFundResult {
  monthlyNetIncome: number | null;
  annualNetIncome: number | null;
  incomeSource: EmergencyFundIncomeSource;
  emergencyFundMin: number | null;
  emergencyFundTarget: number | null;
  currentCash: number;
  coverageMonths: number | null;
  status: EmergencyFundStatus | 'INDISPONIBLE';
}

/**
 * Résout le revenu net annuel pour le calcul d’épargne de sécurité.
 * - Priorité : `revenuGlobalEstime` (même logique que la carte « Revenus nets annuels »).
 * - Si nul / négligeable et simulation fiscale présente : `revenuLocatifNetAnnual`.
 */
export function resolveAnnualNetIncomeForEmergencyFund(input: {
  revenuGlobalEstime: number;
  revenuLocatifNetAnnual: number;
  hasFiscalSimulation: boolean;
}): { annualNetIncome: number | null; incomeSource: EmergencyFundIncomeSource } {
  const global = Number.isFinite(input.revenuGlobalEstime) ? Math.max(0, input.revenuGlobalEstime) : 0;
  if (global >= MIN_ANNUAL_NET) {
    return { annualNetIncome: global, incomeSource: 'REVENU_GLOBAL_ESTIME' };
  }
  const loc = Number.isFinite(input.revenuLocatifNetAnnual) ? Math.max(0, input.revenuLocatifNetAnnual) : 0;
  if (input.hasFiscalSimulation && loc >= MIN_ANNUAL_NET) {
    return { annualNetIncome: loc, incomeSource: 'LOCATIF_NET_SEUL' };
  }
  return { annualNetIncome: null, incomeSource: 'INDISPONIBLE' };
}

export function computeEmergencyFund(params: EmergencyFundInput): EmergencyFundResult {
  const cash = Number.isFinite(params.currentCash) ? Math.max(0, params.currentCash) : 0;
  const { annualNetIncome, incomeSource } = resolveAnnualNetIncomeForEmergencyFund({
    revenuGlobalEstime: params.revenuGlobalEstime,
    revenuLocatifNetAnnual: params.revenuLocatifNetAnnual,
    hasFiscalSimulation: params.hasFiscalSimulation,
  });

  if (annualNetIncome == null || annualNetIncome < MIN_ANNUAL_NET) {
    return {
      monthlyNetIncome: null,
      annualNetIncome: null,
      incomeSource,
      emergencyFundMin: null,
      emergencyFundTarget: null,
      currentCash: cash,
      coverageMonths: null,
      status: 'INDISPONIBLE',
    };
  }

  const monthly = annualNetIncome / 12;
  if (!Number.isFinite(monthly) || monthly < MIN_ANNUAL_NET / 12) {
    return {
      monthlyNetIncome: null,
      annualNetIncome: null,
      incomeSource,
      emergencyFundMin: null,
      emergencyFundTarget: null,
      currentCash: cash,
      coverageMonths: null,
      status: 'INDISPONIBLE',
    };
  }

  const monthlyRounded = Math.round(monthly * 100) / 100;
  const minReserve = Math.round(monthlyRounded * MONTHS_MIN * 100) / 100;
  const targetReserve = Math.round(monthlyRounded * MONTHS_TARGET * 100) / 100;
  const coverage = cash / monthlyRounded;
  const coverageMonths = Number.isFinite(coverage) ? Math.round(coverage * 10) / 10 : null;

  let status: EmergencyFundStatus;
  if (coverage < MONTHS_MIN) {
    status = 'CRITIQUE';
  } else if (coverage < MONTHS_TARGET) {
    status = 'A_RENFORCER';
  } else {
    status = 'CONFORTABLE';
  }

  return {
    monthlyNetIncome: monthlyRounded,
    annualNetIncome: Math.round(annualNetIncome * 100) / 100,
    incomeSource,
    emergencyFundMin: minReserve,
    emergencyFundTarget: targetReserve,
    currentCash: cash,
    coverageMonths,
    status,
  };
}

const EPARGNE_PRIORITY_MESSAGE = 'Priorité à l’épargne de sécurité';

/**
 * Ajuste la recommandation marché selon la couverture d’épargne de sécurité.
 * - CRITIQUE : pas de renfort opportuniste ; DCA fortement réduit ; message explicite.
 * - À RENFORCER : renforts opportunistes réduits de moitié ; DCA inchangé.
 * - CONFORTABLE / INDISPONIBLE : pas de modification.
 */
export function adjustInvestmentRecommendationForEmergencyFund(
  rec: InvestmentRecommendation,
  fund: Pick<EmergencyFundResult, 'status'>
): InvestmentRecommendation {
  if (fund.status === 'INDISPONIBLE' || fund.status === 'CONFORTABLE') {
    return rec;
  }

  const dcaCritiqueFactor = 0.5;
  let monthlyDcaPortion = rec.monthlyDcaPortion;
  let reinforcePortion = rec.reinforcePortion;
  let message = rec.message;
  let reason = rec.reason;

  if (fund.status === 'CRITIQUE') {
    reinforcePortion = 0;
    monthlyDcaPortion = Math.round(rec.monthlyDcaPortion * dcaCritiqueFactor * 100) / 100;
    message = EPARGNE_PRIORITY_MESSAGE;
    reason = `${rec.reason} — ${EPARGNE_PRIORITY_MESSAGE} : réserve inférieure à 3 mois de revenu net.`;
  } else if (fund.status === 'A_RENFORCER') {
    reinforcePortion = Math.round(rec.reinforcePortion * 0.5 * 100) / 100;
    reason = `${rec.reason} — Renforts opportunistes réduits : couverture entre 3 et 6 mois de revenu net.`;
  }

  const combined = Math.round((monthlyDcaPortion + reinforcePortion) * 100) / 100;

  return {
    ...rec,
    monthlyDcaPortion,
    reinforcePortion,
    suggestedAmount: combined,
    baseAmount: combined,
    message,
    reason,
  };
}
