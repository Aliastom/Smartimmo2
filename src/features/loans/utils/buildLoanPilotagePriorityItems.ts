import type { Loan } from '@/features/loans/hooks/useLoansData';
import type { PortfolioPilotageIndex } from './computePortfolioPilotageMetrics';

export type LoanPilotagePriorityBadge = 'negative_cf' | 'heavy_payment';

export interface LoanPilotagePriorityRow {
  loan: Loan;
  badge: LoanPilotagePriorityBadge;
  monthlyPayment: number;
  /** Cashflow net mensuel du bien (locatif − somme des mensualités). */
  propertyNetMonthly: number;
  /** Part du cashflow du bien représentée par ce prêt (si cashflow > 0). */
  paymentShareOfCashflow: number | null;
}

function isActiveLoan(l: Loan): boolean {
  return l.loanBusinessStatus === 'actif';
}

function monthlyPayment(l: Loan): number {
  return l.loanDisplay?.monthlyPayment ?? l.monthlyPayment ?? 0;
}

/**
 * Jusqu’à `maxItems` prêts à mettre en avant : biens en cashflow négatif (un prêt représentatif
 * par bien, mensualité max), puis mensualités « lourdes » (> 80 % du cashflow), sans doublon.
 */
export function buildLoanPilotagePriorityItems(
  allLoans: Loan[],
  cashflowMonthlyByPropertyId: Map<string, number>,
  pilotage: PortfolioPilotageIndex,
  maxItems = 4
): LoanPilotagePriorityRow[] {
  const active = allLoans.filter(isActiveLoan);
  if (active.length === 0) return [];

  const monthlySumByProperty = new Map<string, number>();
  for (const l of active) {
    const pid = l.propertyId;
    monthlySumByProperty.set(pid, (monthlySumByProperty.get(pid) ?? 0) + monthlyPayment(l));
  }

  type NegCand = { loan: Loan; net: number; pid: string };
  const negativeCandidates: NegCand[] = [];

  for (const pid of pilotage.negativeCashflowPropertyIds) {
    const onProp = active.filter((l) => l.propertyId === pid);
    if (onProp.length === 0) continue;
    const cf = cashflowMonthlyByPropertyId.get(pid) ?? 0;
    const sum = monthlySumByProperty.get(pid) ?? 0;
    const net = cf - sum;
    const loan = [...onProp].sort((a, b) => monthlyPayment(b) - monthlyPayment(a))[0];
    negativeCandidates.push({ loan, net, pid });
  }

  negativeCandidates.sort((a, b) => a.net - b.net);

  const rows: LoanPilotagePriorityRow[] = [];
  const seen = new Set<string>();

  const pushRow = (r: LoanPilotagePriorityRow) => {
    if (rows.length >= maxItems) return;
    if (seen.has(r.loan.id)) return;
    seen.add(r.loan.id);
    rows.push(r);
  };

  for (const { loan, net, pid } of negativeCandidates) {
    if (rows.length >= maxItems) break;
    const cf = cashflowMonthlyByPropertyId.get(pid) ?? 0;
    const m = monthlyPayment(loan);
    const share = cf > 0 ? m / cf : null;
    pushRow({
      loan,
      badge: 'negative_cf',
      monthlyPayment: m,
      propertyNetMonthly: net,
      paymentShareOfCashflow: share,
    });
  }

  const heavySorted = active
    .filter((l) => pilotage.heavyPaymentLoanIds.has(l.id))
    .map((loan) => {
      const pid = loan.propertyId;
      const cf = cashflowMonthlyByPropertyId.get(pid) ?? 0;
      const m = monthlyPayment(loan);
      const sum = monthlySumByProperty.get(pid) ?? 0;
      const net = cf - sum;
      const ratio = cf > 0 ? m / cf : 0;
      return { loan, ratio, net, m, cf };
    })
    .sort((a, b) => b.ratio - a.ratio);

  for (const { loan, ratio, net, m, cf } of heavySorted) {
    if (rows.length >= maxItems) break;
    if (seen.has(loan.id)) continue;
    const share = cf > 0 ? ratio : null;
    pushRow({
      loan,
      badge: 'heavy_payment',
      monthlyPayment: m,
      propertyNetMonthly: net,
      paymentShareOfCashflow: share,
    });
  }

  return rows;
}
