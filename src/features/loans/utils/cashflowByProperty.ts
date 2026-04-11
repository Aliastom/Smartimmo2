import type { CachedNature, LocalTransaction } from '@/lib/offline/db';

const CASHFLOW_PERIOD_MONTHS = 12;

function buildLast12MonthKeys(now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = CASHFLOW_PERIOD_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

/**
 * Cashflow mensuel moyen par bien (12 derniers mois), même logique que useTransactionsKpis.
 */
export function computeCashflowMonthlyAverageByProperty(
  transactions: LocalTransaction[],
  natureMap: Map<string, CachedNature>,
  now: Date = new Date(),
): Map<string, number> {
  const monthlyByProp = new Map<string, Record<string, number>>();

  for (const t of transactions) {
    const pid = t.propertyId;
    if (!pid) continue;

    const acc = (t as { accounting_month?: string; accountingMonth?: string }).accounting_month
      ?? (t as { accountingMonth?: string }).accountingMonth;
    const month =
      acc ??
      (t.date
        ? `${new Date(t.date).getFullYear()}-${String(new Date(t.date).getMonth() + 1).padStart(2, '0')}`
        : null);
    if (!month) continue;

    const amount = t.amount || 0;
    const natureKey = t.nature || '';
    const natureData = natureKey ? natureMap.get(natureKey) : null;
    const flow = natureData?.flow?.toUpperCase() || (amount > 0 ? 'INCOME' : 'EXPENSE');
    const signed = flow === 'EXPENSE' ? -Math.abs(amount) : Math.abs(amount);

    let rec = monthlyByProp.get(pid);
    if (!rec) {
      rec = {};
      monthlyByProp.set(pid, rec);
    }
    rec[month] = (rec[month] ?? 0) + signed;
  }

  const last12 = buildLast12MonthKeys(now);
  const out = new Map<string, number>();

  for (const [pid, rec] of monthlyByProp) {
    const total = last12.reduce((s, m) => s + (rec[m] ?? 0), 0);
    out.set(pid, total / CASHFLOW_PERIOD_MONTHS);
  }

  return out;
}
