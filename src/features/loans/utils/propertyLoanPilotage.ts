import type { Loan } from '@/features/loans/hooks/useLoansData';

/** Taux à partir duquel on suggère une renégociation (affichage pilotage). */
export const LOAN_PILOTAGE_HIGH_RATE_PCT = 4.5;

/** Durée restante (mois) en dessous de laquelle on alerte « fin proche ». */
export const LOAN_PILOTAGE_END_SOON_MONTHS = 24;

export type LoanPilotageStatus = 'ok' | 'optimisable' | 'a_surveiller';

export interface PropertyLoanAggregates {
  mensualiteTotale: number;
  crdTotal: number;
  /** Capital restant dû + intérêts restants (somme des prêts actifs). */
  coutRestant: number;
  activeLoans: Loan[];
  avgRemainingMonths: number;
}

export function aggregateActivePropertyLoans(loans: Loan[]): PropertyLoanAggregates {
  const activeLoans = loans.filter((l) => l.loanBusinessStatus === 'actif');

  let mensualiteTotale = 0;
  let crdTotal = 0;
  let coutRestant = 0;
  let sumRemainingMonths = 0;

  for (const loan of activeLoans) {
    const m = loan.loanDisplay?.monthlyPayment ?? loan.monthlyPayment ?? 0;
    const crd = loan.loanDisplay?.currentCRD ?? 0;
    const intRest = loan.loanDisplay?.remainingInterests ?? 0;
    const rm = loan.loanDisplay?.remainingMonths ?? 0;

    mensualiteTotale += m;
    crdTotal += crd;
    coutRestant += crd + intRest;
    sumRemainingMonths += rm;
  }

  const avgRemainingMonths =
    activeLoans.length > 0 ? Math.round((sumRemainingMonths / activeLoans.length) * 10) / 10 : 0;

  return {
    mensualiteTotale,
    crdTotal,
    coutRestant,
    activeLoans,
    avgRemainingMonths,
  };
}

/**
 * Score crédit synthétique (OK / À surveiller / Optimisable) pour un prêt actif.
 * Combine : taux, durée restante, part de la mensualité dans le cashflow moyen du bien (12 mois).
 *
 * Priorité : risques (à surveiller) avant opportunité (optimisable).
 *
 * @param cashflowWeightPct — `mensualité / cashflow bien × 100`, ou `null` si cashflow non calculable
 */
export function getLoanPilotageStatus(
  loan: Loan,
  cashflowWeightPct: number | null = null,
): LoanPilotageStatus {
  if (loan.loanBusinessStatus !== 'actif') {
    return 'ok';
  }

  const months = loan.loanDisplay?.remainingMonths ?? 0;
  const rate = Number(loan.annualRatePct ?? 0);

  // À surveiller : échéance proche
  if (months > 0 && months <= LOAN_PILOTAGE_END_SOON_MONTHS) {
    return 'a_surveiller';
  }

  // À surveiller : poids du crédit vs cashflow (aligné sur la colonne « Poids dans cashflow »)
  if (cashflowWeightPct !== null) {
    if (cashflowWeightPct > 80) {
      return 'a_surveiller';
    }
    if (cashflowWeightPct >= 50) {
      return 'a_surveiller';
    }
  }

  // Optimisable : taux élevé, sans signal « à surveiller » ci-dessus
  if (rate >= LOAN_PILOTAGE_HIGH_RATE_PCT) {
    return 'optimisable';
  }

  return 'ok';
}

export function loanPilotageStatusLabel(status: LoanPilotageStatus): string {
  switch (status) {
    case 'optimisable':
      return 'Optimisable';
    case 'a_surveiller':
      return 'À surveiller';
    default:
      return 'OK';
  }
}
