import type { Transaction } from '@/features/transactions/hooks/useTransactionsData';

/** Clé nature pour lookup dans la map (compatible API `key` et enrichissement local `id`). */
export function transactionNatureKey(t: Transaction): string {
  if (typeof t.nature === 'string') return t.nature;
  const n = t.nature as { key?: string; id?: string } | undefined;
  return n?.key ?? n?.id ?? '';
}

/** Même règle de flux que `computePropertyGestionMetrics` (KPI / tableaux de rapprochement). */
export function gestionFlowLabel(
  t: Transaction,
  naturesMap: Map<string, { flow?: string }>
): 'Recette' | 'Dépense' | string {
  const amount = t.amount || 0;
  const natureKey = transactionNatureKey(t);
  const natureData = naturesMap.get(natureKey);
  let flow = natureData?.flow?.toUpperCase() || '';
  if (!flow) {
    const nt = (t.nature as { type?: string } | undefined)?.type?.toUpperCase() || '';
    if (nt === 'RECETTE') flow = 'INCOME';
    else if (nt === 'DEPENSE') flow = 'EXPENSE';
  }
  if (!flow) flow = amount > 0 ? 'INCOME' : 'EXPENSE';
  if (flow === 'RECETTE' || flow === 'INCOME') return 'Recette';
  if (flow === 'DEPENSE' || flow === 'EXPENSE') return 'Dépense';
  return flow || '?';
}

export type PropertyGestionMetrics = {
  transactionCount: number;
  recettesCount: number;
  depensesCount: number;
  totalRecettes: number;
  /** Somme des dépenses en valeur positive (comme les KPI) */
  totalDepensesAbs: number;
  soldeNet: number;
};

/** Mois comptable dans [periodStart, periodEnd] (même règle que les KPI). */
export function filterTransactionsByAccountingPeriod(
  sortedTransactions: Transaction[],
  periodStart: string,
  periodEnd: string
): Transaction[] {
  return sortedTransactions.filter((t) => {
    const accountingMonth =
      (t as { accounting_month?: string; accountingMonth?: string }).accounting_month ??
      (t as { accountingMonth?: string }).accountingMonth;
    if (accountingMonth) {
      return accountingMonth >= periodStart && accountingMonth <= periodEnd;
    }
    if (t.date) {
      const d = new Date(t.date);
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return month >= periodStart && month <= periodEnd;
    }
    return false;
  });
}

/**
 * Même logique de flux que les KPI transactions (mois comptable dans [periodStart, periodEnd]).
 */
export function computePropertyGestionMetrics(
  sortedTransactions: Transaction[],
  naturesMap: Map<string, { flow?: string }>,
  periodStart: string,
  periodEnd: string
): PropertyGestionMetrics {
  const rows = filterTransactionsByAccountingPeriod(sortedTransactions, periodStart, periodEnd);

  let recettesCount = 0;
  let depensesCount = 0;
  let totalRecettes = 0;
  let depensesTotalesNeg = 0;

  for (const t of rows) {
    const amount = t.amount || 0;
    const natureKey = transactionNatureKey(t);
    const natureData = naturesMap.get(natureKey);
    let flow = natureData?.flow?.toUpperCase() || '';
    if (!flow) {
      const nt = (t.nature as { type?: string } | undefined)?.type?.toUpperCase() || '';
      if (nt === 'RECETTE') flow = 'INCOME';
      else if (nt === 'DEPENSE') flow = 'EXPENSE';
    }
    if (!flow) {
      flow = amount > 0 ? 'INCOME' : 'EXPENSE';
    }
    const isIncome = flow === 'RECETTE' || flow === 'INCOME';
    if (isIncome) {
      recettesCount += 1;
      totalRecettes += Math.abs(amount);
    } else {
      depensesCount += 1;
      depensesTotalesNeg += -Math.abs(amount);
    }
  }

  return {
    transactionCount: rows.length,
    recettesCount,
    depensesCount,
    totalRecettes,
    totalDepensesAbs: Math.abs(depensesTotalesNeg),
    soldeNet: totalRecettes + depensesTotalesNeg,
  };
}
