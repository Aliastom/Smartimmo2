import type { RentalPropertyResult } from '@/types/fiscal';

export type LmnpChargesVentilationAggregate = {
  /** Somme des charges issues uniquement des transactions (hors forfait / prêt), en € */
  chargesFromTransactions: number;
  /** Part hors transactions (forfait, intérêts, assurance, autres), en € */
  chargesOutsideTransactions: number;
  /** Équivalent charges totales retenues par le simulateur pour la ligne « Charges déductibles », en € */
  chargesTotalSimulator: number;
  loanInterests: number;
  loanInsurance: number;
  forfaitOrCalculated: number;
  /** Écart résiduel si agrégat échéancier ≠ intérêts fusionnés moteur */
  other: number;
  hasData: boolean;
};

function centsToEuro(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Agrège la ventilation LMNP (plusieurs biens BIC au réel) à partir de `perimetreDiagnostic`.
 */
export function aggregateLmnpChargesVentilation(biens: RentalPropertyResult[]): LmnpChargesVentilationAggregate {
  let chargesFromTransactionsCents = 0;
  let chargesOutsideTransactionsCents = 0;
  let chargesTotalSimulatorCents = 0;
  let loanInterestsCents = 0;
  let loanInsuranceCents = 0;
  let forfaitCents = 0;
  let otherCents = 0;
  let n = 0;

  for (const b of biens) {
    const p = b.breakdown?.lmnpDebug?.perimetreDiagnostic;
    if (!p || typeof p.chargesFromTransactionsCents !== 'number') continue;
    n += 1;
    chargesFromTransactionsCents += p.chargesFromTransactionsCents;
    if (typeof p.chargesOutsideTransactionsCents === 'number') {
      chargesOutsideTransactionsCents += p.chargesOutsideTransactionsCents;
    }
    if (typeof p.chargesTotalSimulatorCents === 'number') {
      chargesTotalSimulatorCents += p.chargesTotalSimulatorCents;
    }
    const br = p.outsideTransactionsBreakdown;
    if (br) {
      loanInterestsCents += br.loanInterestsCents ?? 0;
      loanInsuranceCents += br.loanInsuranceCents ?? 0;
      forfaitCents += br.forfaitOrCalculatedChargesCents ?? 0;
      otherCents += br.otherCents ?? 0;
    }
  }

  if (n === 0) {
    return {
      chargesFromTransactions: 0,
      chargesOutsideTransactions: 0,
      chargesTotalSimulator: 0,
      loanInterests: 0,
      loanInsurance: 0,
      forfaitOrCalculated: 0,
      other: 0,
      hasData: false,
    };
  }

  return {
    chargesFromTransactions: centsToEuro(chargesFromTransactionsCents),
    chargesOutsideTransactions: centsToEuro(chargesOutsideTransactionsCents),
    chargesTotalSimulator: centsToEuro(chargesTotalSimulatorCents),
    loanInterests: centsToEuro(loanInterestsCents),
    loanInsurance: centsToEuro(loanInsuranceCents),
    forfaitOrCalculated: centsToEuro(forfaitCents),
    other: centsToEuro(otherCents),
    hasData: true,
  };
}
