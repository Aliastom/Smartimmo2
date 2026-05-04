import type { Transaction } from '@/features/transactions/hooks/useTransactionsData';
import {
  computeTransactionKpiTotals,
  filterTransactionsForScope,
  resolveTransactionKind,
  type NatureFlowMap,
  type TransactionLike,
} from '@/features/transactions/lib/transactionAggregation';

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

/** Mois comptable dans [periodStart, periodEnd] (même règle que les KPI / agrégation centrale). */
export function filterTransactionsByAccountingPeriod(
  sortedTransactions: Transaction[],
  periodStart: string,
  periodEnd: string
): Transaction[] {
  return filterTransactionsForScope(
    sortedTransactions as unknown as TransactionLike[],
    { periodStart, periodEnd },
    new Map()
  ) as unknown as Transaction[];
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
  const natureMapAgg = naturesMap as unknown as NatureFlowMap;
  const rows = filterTransactionsForScope(
    sortedTransactions as unknown as TransactionLike[],
    { periodStart, periodEnd },
    natureMapAgg
  ) as unknown as Transaction[];

  let recettesCount = 0;
  let depensesCount = 0;
  for (const t of rows) {
    const kind = resolveTransactionKind(t as unknown as TransactionLike, natureMapAgg);
    if (kind === 'income') recettesCount += 1;
    else depensesCount += 1;
  }

  const totals = computeTransactionKpiTotals(rows as unknown as TransactionLike[], natureMapAgg);

  return {
    transactionCount: rows.length,
    recettesCount,
    depensesCount,
    totalRecettes: totals.recettesTotales,
    totalDepensesAbs: totals.depensesTotales,
    soldeNet: totals.soldeNet,
  };
}
