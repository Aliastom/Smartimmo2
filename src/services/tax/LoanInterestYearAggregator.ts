/**
 * Agrégation des intérêts d'emprunt **par année civile** à partir de l'échéancier
 * (amortissement à mensualité constante + différé intérêt seul), aligné sur `buildSchedule`.
 *
 * - Seules les composantes **intérêt** des échéances dont la date tombe dans l'année sont retenues.
 * - Le **capital** amorti n'est jamais inclus.
 * - Pas de montant « inventé » : prêt incomplet ou modèle non supporté → 0 € pour ce prêt + ambiguïté.
 */

import { buildSchedule, type ScheduleRow } from '@/lib/finance/amortization';
import type {
  Fiscal2044InteretsEmpruntAnnuel,
  Fiscal2044LoanInterestAmbiguity,
  Fiscal2044LoanInterestPerLoan,
} from '@/types/fiscal';

export type LoanInterestYearLoanInput = {
  id: string;
  propertyId: string;
  label: string;
  principal: unknown;
  annualRatePct: unknown;
  durationMonths: number;
  defermentMonths?: number | null;
  insurancePct?: unknown | null;
  startDate: Date | string;
  endDate?: Date | string | null;
  paymentDay?: number | null;
  repaymentType?: string | null;
  amortizationProfile?: string | null;
  rateType?: string | null;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function parseLoanEnd(loan: LoanInterestYearLoanInput): Date | null {
  if (!loan.endDate) return null;
  const d = new Date(loan.endDate);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Année civile de la date d'échéance (YYYY-MM ou YYYY-MM-DD, fuseau local). */
export function scheduleRowCalendarYear(row: ScheduleRow): number {
  const y = parseInt(row.date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : NaN;
}

function rowPaymentDate(row: ScheduleRow): Date {
  const parts = row.date.split('-').map((p) => parseInt(p, 10));
  const y = parts[0];
  const m = parts[1];
  const d = parts[2] || 1;
  return new Date(y, m - 1, d);
}

function isRowInCalendarYear(row: ScheduleRow, year: number): boolean {
  return scheduleRowCalendarYear(row) === year;
}

function isRowOnOrBeforeEnd(row: ScheduleRow, end: Date): boolean {
  const t = rowPaymentDate(row).getTime();
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return t <= endDay;
}

export interface LoanInterestYearAggregateInput {
  loans: LoanInterestYearLoanInput[];
  year: number;
  /** Bien attendu : tout prêt dont le propertyId diffère génère une ambiguïté et est ignoré. */
  expectedPropertyId: string;
}

function pushAmbiguity(
  list: Fiscal2044LoanInterestAmbiguity[],
  loan: LoanInterestYearLoanInput,
  reason: string
) {
  list.push({ loanId: loan.id, loanLabel: loan.label || loan.id, reason });
}

class LoanInterestYearAggregatorClass {
  aggregate(input: LoanInterestYearAggregateInput): Fiscal2044InteretsEmpruntAnnuel {
    const { loans, year, expectedPropertyId } = input;
    const ambiguities: Fiscal2044LoanInterestAmbiguity[] = [];
    const byLoan: Fiscal2044LoanInterestPerLoan[] = [];
    let totalInteretsEmprunt = 0;
    let totalAssuranceEmprunteur = 0;

    for (const loan of loans) {
      if (loan.propertyId !== expectedPropertyId) {
        pushAmbiguity(
          ambiguities,
          loan,
          'Prêt non rattaché au bien en cours d’agrégation (propertyId différent) — montant exclu.'
        );
        continue;
      }

      const repayment = (loan.repaymentType || 'CLASSIC').toUpperCase();
      if (repayment === 'IN_FINE' || repayment.includes('FINE')) {
        pushAmbiguity(
          ambiguities,
          loan,
          'Remboursement in fine : modèle d’échéancier non pris en charge pour l’agrégation annuelle — montant exclu.'
        );
        continue;
      }

      const profile = (loan.amortizationProfile || 'CONSTANT_PAYMENT').toUpperCase();
      if (profile.includes('CONSTANT_AMORTIZATION') || profile.includes('AMORTIZATION')) {
        pushAmbiguity(
          ambiguities,
          loan,
          'Profil amortissement à capital constant : non modélisé — montant exclu.'
        );
        continue;
      }

      const rateType = (loan.rateType || 'FIXED').toUpperCase();
      if (rateType !== 'FIXED') {
        pushAmbiguity(ambiguities, loan, `Type de taux « ${loan.rateType} » : seul FIXED est pris en charge — montant exclu.`);
        continue;
      }

      const principal = toNumber(loan.principal);
      const annualRatePct = toNumber(loan.annualRatePct);
      const durationMonths = Number(loan.durationMonths);
      const defermentMonths = Number(loan.defermentMonths ?? 0);

      if (principal === null || principal <= 0) {
        pushAmbiguity(ambiguities, loan, 'Capital initial manquant ou non fiable — intérêts non calculés.');
        continue;
      }
      if (annualRatePct === null || annualRatePct < 0) {
        pushAmbiguity(ambiguities, loan, 'Taux annuel manquant ou non fiable — intérêts non calculés.');
        continue;
      }
      if (!Number.isFinite(durationMonths) || durationMonths <= 0) {
        pushAmbiguity(ambiguities, loan, 'Durée du prêt manquante ou non fiable — intérêts non calculés.');
        continue;
      }

      const startDate = new Date(loan.startDate);
      if (!Number.isFinite(startDate.getTime())) {
        pushAmbiguity(ambiguities, loan, 'Date de début de prêt invalide — intérêts non calculés.');
        continue;
      }

      const loanEnd = parseLoanEnd(loan);
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
      if (loanEnd && loanEnd < yearStart) {
        continue;
      }
      if (startDate > yearEnd) {
        continue;
      }

      const insurancePct = toNumber(loan.insurancePct) ?? 0;

      let schedule: ScheduleRow[];
      try {
        schedule = buildSchedule({
          principal,
          annualRatePct,
          durationMonths,
          defermentMonths: Math.max(0, defermentMonths),
          insurancePct,
          startDate,
          paymentDay: loan.paymentDay ?? undefined,
        });
      } catch {
        pushAmbiguity(ambiguities, loan, 'Impossible de construire l’échéancier (données incohérentes).');
        continue;
      }

      let interetsPayesAnnee = 0;
      let assurancePayeeAnnee = 0;
      let nombreEcheancesDansAnnee = 0;

      for (const row of schedule) {
        if (!isRowInCalendarYear(row, year)) continue;
        if (loanEnd && !isRowOnOrBeforeEnd(row, loanEnd)) continue;
        interetsPayesAnnee += row.paymentInterest;
        assurancePayeeAnnee += row.paymentInsurance;
        nombreEcheancesDansAnnee += 1;
      }

      interetsPayesAnnee = Math.round(interetsPayesAnnee * 100) / 100;
      assurancePayeeAnnee = Math.round(assurancePayeeAnnee * 100) / 100;

      totalInteretsEmprunt += interetsPayesAnnee;
      totalAssuranceEmprunteur += assurancePayeeAnnee;

      byLoan.push({
        loanId: loan.id,
        label: loan.label,
        interetsPayesAnnee,
        assurancePayeeAnnee,
        nombreEcheancesDansAnnee,
        source: 'echeancier_amortissement',
      });
    }

    totalInteretsEmprunt = Math.round(totalInteretsEmprunt * 100) / 100;
    totalAssuranceEmprunteur = Math.round(totalAssuranceEmprunteur * 100) / 100;

    return {
      annee: year,
      totalInteretsEmprunt,
      totalAssuranceEmprunteur,
      byLoan,
      ambiguities,
    };
  }
}

export const LoanInterestYearAggregator = new LoanInterestYearAggregatorClass();

/**
 * Agrège les intérêts / assurance emprunteur sur un ou plusieurs biens (ex. activité LMNP multi-biens).
 * Un seul appel par bien pour réutiliser la logique d’ambiguïtés existante, puis somme.
 */
export function aggregateLoanInterestsForProperties(
  loans: LoanInterestYearLoanInput[],
  year: number,
  propertyIds: string[]
): Fiscal2044InteretsEmpruntAnnuel {
  if (propertyIds.length === 0) {
    return {
      annee: year,
      totalInteretsEmprunt: 0,
      totalAssuranceEmprunteur: 0,
      byLoan: [],
      ambiguities: [],
    };
  }
  if (propertyIds.length === 1) {
    return LoanInterestYearAggregator.aggregate({
      loans,
      year,
      expectedPropertyId: propertyIds[0]!,
    });
  }
  const merged: Fiscal2044InteretsEmpruntAnnuel = {
    annee: year,
    totalInteretsEmprunt: 0,
    totalAssuranceEmprunteur: 0,
    byLoan: [],
    ambiguities: [],
  };
  for (const pid of propertyIds) {
    const a = LoanInterestYearAggregator.aggregate({
      loans,
      year,
      expectedPropertyId: pid,
    });
    merged.totalInteretsEmprunt += a.totalInteretsEmprunt;
    merged.totalAssuranceEmprunteur += a.totalAssuranceEmprunteur;
    merged.byLoan.push(...a.byLoan);
    merged.ambiguities.push(...a.ambiguities);
  }
  merged.totalInteretsEmprunt = Math.round(merged.totalInteretsEmprunt * 100) / 100;
  merged.totalAssuranceEmprunteur = Math.round(merged.totalAssuranceEmprunteur * 100) / 100;
  return merged;
}
