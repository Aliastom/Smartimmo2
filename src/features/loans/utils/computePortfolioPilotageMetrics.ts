import type { Loan } from '@/features/loans/hooks/useLoansData';

/** Seuil « taux élevé » — page pilotage portefeuille (cohérent avec la spec > 4 %). */
export const PORTFOLIO_HIGH_RATE_PCT = 4;

export const PORTFOLIO_HEAVY_PAYMENT_RATIO = 0.8;

export interface PortfolioPilotageIndex {
  negativeCashflowPropertyIds: Set<string>;
  negativeCashflowPropertyCount: number;
  heavyPaymentLoanIds: Set<string>;
  heavyPaymentLoanCount: number;
  highRateLoanIds: Set<string>;
  highRateLoanCount: number;
}

function isActiveLoan(l: Loan): boolean {
  return l.loanBusinessStatus === 'actif';
}

function monthlyPayment(l: Loan): number {
  return l.loanDisplay?.monthlyPayment ?? l.monthlyPayment ?? 0;
}

export function computePortfolioPilotageMetrics(
  allLoans: Loan[],
  cashflowMonthlyByPropertyId: Map<string, number>,
): PortfolioPilotageIndex {
  const monthlySumByProperty = new Map<string, number>();
  for (const l of allLoans) {
    if (!isActiveLoan(l)) continue;
    const pid = l.propertyId;
    monthlySumByProperty.set(pid, (monthlySumByProperty.get(pid) ?? 0) + monthlyPayment(l));
  }

  const negativeCashflowPropertyIds = new Set<string>();
  for (const [pid, sumMonthly] of monthlySumByProperty) {
    const cf = cashflowMonthlyByPropertyId.get(pid) ?? 0;
    if (cf - sumMonthly < 0) {
      negativeCashflowPropertyIds.add(pid);
    }
  }

  const heavyPaymentLoanIds = new Set<string>();
  for (const l of allLoans) {
    if (!isActiveLoan(l)) continue;
    const m = monthlyPayment(l);
    const cf = cashflowMonthlyByPropertyId.get(l.propertyId) ?? 0;
    if (cf > 0 && m / cf > PORTFOLIO_HEAVY_PAYMENT_RATIO) {
      heavyPaymentLoanIds.add(l.id);
    }
  }

  const highRateLoanIds = new Set<string>();
  for (const l of allLoans) {
    if (!isActiveLoan(l)) continue;
    if (Number(l.annualRatePct) > PORTFOLIO_HIGH_RATE_PCT) {
      highRateLoanIds.add(l.id);
    }
  }

  return {
    negativeCashflowPropertyIds,
    negativeCashflowPropertyCount: negativeCashflowPropertyIds.size,
    heavyPaymentLoanIds,
    heavyPaymentLoanCount: heavyPaymentLoanIds.size,
    highRateLoanIds,
    highRateLoanCount: highRateLoanIds.size,
  };
}
