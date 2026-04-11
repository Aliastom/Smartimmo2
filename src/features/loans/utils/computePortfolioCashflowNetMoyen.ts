import type { Loan } from '@/features/loans/hooks/useLoansData';

/**
 * Moyenne, par bien ayant au moins un prêt actif, de :
 * (cashflow brut mensuel moyen du bien − somme des mensualités des prêts actifs).
 */
export function computePortfolioCashflowNetMoyenApresCredit(
  loans: Loan[],
  cashflowMonthlyByPropertyId: Map<string, number>,
): number | null {
  const monthlyByProperty = new Map<string, number>();
  for (const l of loans) {
    if (l.loanBusinessStatus !== 'actif') continue;
    const m = l.loanDisplay?.monthlyPayment ?? l.monthlyPayment ?? 0;
    monthlyByProperty.set(l.propertyId, (monthlyByProperty.get(l.propertyId) ?? 0) + m);
  }
  const ids = [...monthlyByProperty.keys()];
  if (ids.length === 0) return null;
  let sumNet = 0;
  for (const pid of ids) {
    const cf = cashflowMonthlyByPropertyId.get(pid) ?? 0;
    const mens = monthlyByProperty.get(pid) ?? 0;
    sumNet += cf - mens;
  }
  return sumNet / ids.length;
}
