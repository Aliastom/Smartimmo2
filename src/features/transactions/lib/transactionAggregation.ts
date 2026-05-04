/**
 * Source unique pour classification recette/dépense, filtrage période et agrégations KPI/graphiques.
 */

export type TransactionKind = 'income' | 'expense';

export type TransactionLike = {
  id: string;
  amount?: number | null;
  /** Code nature (API / IndexedDB) ou objet enrichi avec type RECETTE/DEPENSE */
  nature?: string | { type?: string; key?: string; id?: string } | null;
  accounting_month?: string | null;
  accountingMonth?: string | null;
  date?: string | Date | null;
  propertyId?: string | null;
  categoryId?: string | null;
  tenantId?: string | null;
  leaseId?: string | null;
  rapprochementStatus?: string | null;
};

export type NatureFlowMap = Map<string, { flow?: string | null }>;

/** Clé nature pour lookup (aligné `propertyGestionMetrics.transactionNatureKey`). */
export function transactionNatureKeyFromLike(t: TransactionLike): string {
  const n = t.nature;
  if (typeof n === 'string') return n;
  if (n && typeof n === 'object') return n.key ?? n.id ?? '';
  return '';
}

/**
 * Règle unique : jamais ignorer une ligne pour absence de nature —
 * repli signe du montant après nature / type imbriqué.
 */
export function resolveTransactionKind(t: TransactionLike, natureMap: NatureFlowMap): TransactionKind {
  const amount = Number(t.amount) || 0;
  const natureKey = transactionNatureKeyFromLike(t);
  const natureData = natureKey ? natureMap.get(natureKey) : undefined;
  let flow = natureData?.flow?.toUpperCase() || '';

  if (!flow) {
    const nt =
      typeof t.nature === 'object' && t.nature && 'type' in t.nature
        ? String((t.nature as { type?: string }).type || '').toUpperCase()
        : '';
    if (nt === 'RECETTE') flow = 'INCOME';
    else if (nt === 'DEPENSE') flow = 'EXPENSE';
  }

  if (flow === 'RECETTE' || flow === 'INCOME') return 'income';
  if (flow === 'DEPENSE' || flow === 'EXPENSE') return 'expense';

  if (!flow) {
    return amount >= 0 ? 'income' : 'expense';
  }
  // Flow non standard en base : repli cohérent sur le signe
  return amount >= 0 ? 'income' : 'expense';
}

export function normalizeTransactionAmount(t: TransactionLike, kind: TransactionKind): number {
  void kind;
  return Math.abs(Number(t.amount) || 0);
}

export function dedupeTransactionsById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Map<string, T>();
  for (const row of rows) {
    if (!row?.id) continue;
    if (!seen.has(row.id)) seen.set(row.id, row);
  }
  return Array.from(seen.values());
}

/** Mois comptable effectif YYYY-MM (fallback sur la date opération). */
export function getEffectiveAccountingMonth(t: TransactionLike): string | null {
  const raw = (t as { accounting_month?: string }).accounting_month ?? t.accountingMonth ?? null;
  if (raw) return raw;
  if (!t.date) return null;
  const d = new Date(t.date as string);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Inclusif [periodStart, periodEnd] sur mois comptable ; si absent, dérivé de `date`
 * (même règle que filtre liste App Shell / `filterTransactionsByAccountingPeriod`).
 */
export function isTransactionInAccountingPeriod(
  t: TransactionLike,
  periodStart: string,
  periodEnd: string
): boolean {
  const month = getEffectiveAccountingMonth(t);
  if (!month) return false;
  return month >= periodStart && month <= periodEnd;
}

export type TransactionScopeFilters = {
  periodStart?: string;
  periodEnd?: string;
  propertyId?: string;
  categoryId?: string;
  tenantId?: string;
  leaseId?: string;
  /** Filtre analytical optionnel */
  flow?: TransactionKind;
};

export function filterTransactionsForScope<T extends TransactionLike>(
  transactions: T[],
  filters: TransactionScopeFilters,
  natureMap: NatureFlowMap
): T[] {
  let list = dedupeTransactionsById(transactions);

  if (filters.periodStart && filters.periodEnd) {
    const ps = filters.periodStart;
    const pe = filters.periodEnd;
    list = list.filter((t) => isTransactionInAccountingPeriod(t, ps, pe));
  }

  if (filters.propertyId) {
    list = list.filter((t) => t.propertyId === filters.propertyId);
  }
  if (filters.categoryId) {
    list = list.filter((t) => t.categoryId === filters.categoryId);
  }
  if (filters.tenantId) {
    list = list.filter((t) => t.tenantId === filters.tenantId);
  }
  if (filters.leaseId) {
    list = list.filter((t) => t.leaseId === filters.leaseId);
  }
  if (filters.flow) {
    list = list.filter((t) => resolveTransactionKind(t, natureMap) === filters.flow);
  }

  return list;
}

export function computeTotalExpenses(transactions: TransactionLike[], natureMap: NatureFlowMap): number {
  let sum = 0;
  for (const t of transactions) {
    if (resolveTransactionKind(t, natureMap) === 'expense') {
      sum += normalizeTransactionAmount(t, 'expense');
    }
  }
  return sum;
}

export function computeTotalIncome(transactions: TransactionLike[], natureMap: NatureFlowMap): number {
  let sum = 0;
  for (const t of transactions) {
    if (resolveTransactionKind(t, natureMap) === 'income') {
      sum += normalizeTransactionAmount(t, 'income');
    }
  }
  return sum;
}

export type TransactionKpiTotals = {
  recettesTotales: number;
  /** Toujours ≥ 0 */
  depensesTotales: number;
  soldeNet: number;
  nonRapprochees: number;
};

export function computeScopedTransactionKpis(
  transactions: TransactionLike[],
  natureMap: NatureFlowMap,
  scope: TransactionScopeFilters
): TransactionKpiTotals {
  const scoped = filterTransactionsForScope(transactions, scope, natureMap);
  return computeTransactionKpiTotals(scoped, natureMap);
}

export function computeTransactionKpiTotals(
  transactions: TransactionLike[],
  natureMap: NatureFlowMap
): TransactionKpiTotals {
  let recettesTotales = 0;
  let depensesTotales = 0;
  let nonRapprochees = 0;

  for (const t of transactions) {
    const kind = resolveTransactionKind(t, natureMap);
    const abs = normalizeTransactionAmount(t, kind);
    if (kind === 'income') recettesTotales += abs;
    else depensesTotales += abs;

    if (t.rapprochementStatus === 'non_rapprochee') {
      nonRapprochees++;
    }
  }

  return {
    recettesTotales,
    depensesTotales,
    soldeNet: recettesTotales - depensesTotales,
    nonRapprochees,
  };
}

const DEBUG_FLAG_LS = 'DEBUG_TX_AGG';

export function isTransactionAggregationDebugEnabled(): boolean {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG_TX_AGG === '1') return true;
  if (typeof window !== 'undefined' && window.localStorage?.getItem(DEBUG_FLAG_LS) === '1') return true;
  return false;
}

export function debugTransactionAggregation(
  label: string,
  transactions: TransactionLike[],
  natureMap: NatureFlowMap
): void {
  if (!isTransactionAggregationDebugEnabled()) return;

  const deduped = dedupeTransactionsById(transactions);
  let bruteExpense = 0;
  let normalizedExpense = 0;
  const expenseIds: string[] = [];

  for (const t of deduped) {
    if (resolveTransactionKind(t, natureMap) === 'expense') {
      bruteExpense += Number(t.amount) || 0;
      normalizedExpense += normalizeTransactionAmount(t, 'expense');
      expenseIds.push(t.id);
    }
  }

  console.log(`[DEBUG_TX_AGG] ${label}`, {
    countAfterDedupe: deduped.length,
    expenseLines: expenseIds.length,
    bruteSumExpenseRaw: bruteExpense,
    normalizedExpensePositive: normalizedExpense,
    expenseIds,
  });
}
