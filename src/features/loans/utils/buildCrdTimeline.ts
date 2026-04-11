import { buildSchedule, crdAtDate } from '@/lib/finance/amortization';

/** Champs minimaux pour recalculer le CRD mois par mois (aligné sur useLoansCharts). */
export interface LoanForCrdTimeline {
  startDate: string;
  endDate?: string | null;
  principal: number;
  annualRatePct: number;
  durationMonths: number;
  defermentMonths?: number | null;
  insurancePct?: number | null;
  paymentDay?: number | null;
  isActive: boolean;
}

export function buildCrdTimelineForLoans(
  loans: LoanForCrdTimeline[],
  months: string[],
): { month: string; crd: number }[] {
  const filteredLoans = loans.filter((loan) => loan.isActive);

  return months.map((month) => {
    let totalCRD = 0;

    for (const loan of filteredLoans) {
      const loanStartDate = new Date(loan.startDate);
      const loanStartMonth = `${loanStartDate.getFullYear()}-${String(loanStartDate.getMonth() + 1).padStart(2, '0')}`;
      const loanEndMonth = loan.endDate
        ? `${new Date(loan.endDate).getFullYear()}-${String(new Date(loan.endDate).getMonth() + 1).padStart(2, '0')}`
        : null;

      if (month >= loanStartMonth && (!loanEndMonth || month <= loanEndMonth)) {
        const schedule = buildSchedule({
          principal: Number(loan.principal),
          annualRatePct: Number(loan.annualRatePct),
          durationMonths: loan.durationMonths,
          defermentMonths: loan.defermentMonths || 0,
          insurancePct: loan.insurancePct ? Number(loan.insurancePct) : 0,
          startDate: loanStartDate,
          paymentDay: loan.paymentDay || undefined,
        });

        totalCRD += crdAtDate(schedule, month);
      }
    }

    return {
      month,
      crd: Math.round(totalCRD * 100) / 100,
    };
  });
}
