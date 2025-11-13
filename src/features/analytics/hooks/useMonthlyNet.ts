import { useMemo } from 'react';
import type { Transaction, Property, MonthlyNetResult } from '../types';

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

type Args = {
  transactions: Transaction[];
  year: number;
  selectedPropertyIds: string[] | null;
  statusFilter: 'all' | 'occupied' | 'vacant';
  properties: Property[];
  showAllYears?: boolean;
};

export function useMonthlyNet({
  transactions,
  year,
  selectedPropertyIds,
  statusFilter,
  properties,
  showAllYears = false,
}: Args): MonthlyNetResult {
  return useMemo(() => {
    if (!transactions?.length) {
      return {
        months: MONTHS,
        monthly: Array.from({ length: 12 }, () => ({ income: 0, expense: 0, net: 0 })),
        cumulative: Array.from({ length: 12 }, () => 0),
        totals: { income: 0, expense: 0, net: 0 },
      };
    }

    // Déterminer les propriétés autorisées selon les filtres
    const allowedProps = new Set(
      (selectedPropertyIds ?? properties.map((p) => p.id)).filter((id) => {
        if (statusFilter === 'all') return true;
        const p = properties.find((pp) => pp.id === id);
        return p ? p.status === statusFilter : false;
      })
    );

    // Initialiser les données mensuelles
    const byMonth = Array.from({ length: 12 }, () => ({ income: 0, expense: 0, net: 0 }));

    // Agréger les transactions par mois
    for (const t of transactions) {
      const d = new Date(t.date);
      if (!showAllYears && d.getFullYear() !== year) continue;
      if (!allowedProps.has(t.propertyId)) continue;

      const m = d.getMonth();
      if (t.kind === 'income') {
        byMonth[m].income += t.amount;
      } else {
        byMonth[m].expense += t.amount;
      }
    }

    // Calculer le net pour chaque mois
    for (const m of byMonth) {
      m.net = m.income - m.expense;
    }

    // Construire le cumul
    const cumulative: number[] = [];
    byMonth.reduce((acc, cur) => {
      const next = acc + cur.net;
      cumulative.push(next);
      return next;
    }, 0);

    // Calculer les totaux annuels
    const totals = byMonth.reduce(
      (acc, m) => ({
        income: acc.income + m.income,
        expense: acc.expense + m.expense,
        net: acc.net + m.net,
      }),
      { income: 0, expense: 0, net: 0 }
    );

    return { months: MONTHS, monthly: byMonth, cumulative, totals };
  }, [transactions, year, selectedPropertyIds, statusFilter, properties]);
}

