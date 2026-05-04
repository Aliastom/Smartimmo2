/**
 * Règles d’affichage pilotage LMNP : l’échéancier (totaux issus du moteur prêt) prime sur les
 * écritures classées, pour éviter intérêts à 0 quand seul l’échéancier est fiable, et éviter
 * le double comptage quand les deux existent.
 */

export type LmnpKpiRow = { lmnp_bucket: string; amount: number };

function sumAmountWhere(rows: LmnpKpiRow[], pred: (bucket: string) => boolean): number {
  return rows
    .filter((r) => pred((r.lmnp_bucket || '').toUpperCase()))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

/** Intérêts d’emprunt reconnus côté écritures (buckets comptables LMNP). */
export function sumTransactionInterestAmounts(rows: LmnpKpiRow[]): number {
  const b = (u: string) => u.includes('FINANCIER') || u.includes('INTERET');
  return sumAmountWhere(rows, b);
}

/** Assurances côté écritures (emprunteur, PNO, etc. — même filtre qu’avant le correctif). */
export function sumTransactionAssuranceAmounts(rows: LmnpKpiRow[]): number {
  return sumAmountWhere(rows, (u) => u.includes('ASSURANCE'));
}

export function resolveLmnpLoanKpisForPilotage(input: {
  /** Montants annuels € issus de l’échéancier (LoanInterestYearAggregator), périmètre export. */
  loanInterestsFromSchedule: number;
  loanInsuranceFromSchedule: number;
  ecritureRows: LmnpKpiRow[];
}): {
  interets: number;
  assurance: number;
  usedScheduleForInterets: boolean;
  usedScheduleForAssurance: boolean;
} {
  const txI = Math.abs(sumTransactionInterestAmounts(input.ecritureRows));
  const txA = Math.abs(sumTransactionAssuranceAmounts(input.ecritureRows));
  const schedI = Math.max(0, Number(input.loanInterestsFromSchedule) || 0);
  const schedA = Math.max(0, Number(input.loanInsuranceFromSchedule) || 0);
  return {
    interets: schedI > 0 ? schedI : txI,
    assurance: schedA > 0 ? schedA : txA,
    usedScheduleForInterets: schedI > 0,
    usedScheduleForAssurance: schedA > 0,
  };
}
