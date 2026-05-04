import { describe, it, expect } from 'vitest';
import {
  computeTotalExpenses,
  dedupeTransactionsById,
  filterTransactionsForScope,
  isTransactionInAccountingPeriod,
  normalizeTransactionAmount,
  resolveTransactionKind,
  type NatureFlowMap,
  type TransactionLike,
} from './transactionAggregation';

function mapNature(flow: Record<string, string>): NatureFlowMap {
  const m = new Map<string, { flow?: string }>();
  for (const [k, v] of Object.entries(flow)) {
    m.set(k, { flow: v });
  }
  return m;
}

describe('transactionAggregation', () => {
  const natures = mapNature({
    LOYER: 'INCOME',
    ENTRETIEN: 'EXPENSE',
  });

  it('cas 1: deux dépenses 100 + 200 → 300', () => {
    const rows: TransactionLike[] = [
      { id: '1', amount: 100, nature: 'ENTRETIEN' },
      { id: '2', amount: 200, nature: 'ENTRETIEN' },
    ];
    expect(computeTotalExpenses(rows, natures)).toBe(300);
  });

  it('cas 2: un revenu 500 + dépenses 100 + 200 → dépenses 300', () => {
    const rows: TransactionLike[] = [
      { id: '1', amount: 500, nature: 'LOYER' },
      { id: '2', amount: 100, nature: 'ENTRETIEN' },
      { id: '3', amount: 200, nature: 'ENTRETIEN' },
    ];
    expect(computeTotalExpenses(rows, natures)).toBe(300);
  });

  it('cas 3: filtre période mois comptable', () => {
    const rows: TransactionLike[] = [
      { id: 'a', amount: 50, nature: 'ENTRETIEN', accountingMonth: '2024-01' },
      { id: 'b', amount: 50, nature: 'ENTRETIEN', accountingMonth: '2024-06' },
    ];
    const scoped = filterTransactionsForScope(rows, { periodStart: '2024-01', periodEnd: '2024-03' }, natures);
    expect(scoped.map((r) => r.id)).toEqual(['a']);
    expect(computeTotalExpenses(scoped, natures)).toBe(50);
  });

  it('cas 4: filtre propertyId', () => {
    const rows: TransactionLike[] = [
      { id: '1', amount: 100, nature: 'ENTRETIEN', propertyId: 'p1' },
      { id: '2', amount: 200, nature: 'ENTRETIEN', propertyId: 'p2' },
    ];
    const scoped = filterTransactionsForScope(rows, { propertyId: 'p1' }, natures);
    expect(computeTotalExpenses(scoped, natures)).toBe(100);
  });

  it('cas 5: montants négatifs en base → dépense positive agrégée', () => {
    const rows: TransactionLike[] = [{ id: '1', amount: -150, nature: 'ENTRETIEN' }];
    expect(computeTotalExpenses(rows, natures)).toBe(150);
    expect(normalizeTransactionAmount(rows[0], 'expense')).toBe(150);
  });

  it('cas 6: duplication id → une seule ligne', () => {
    const rows: TransactionLike[] = [
      { id: 'x', amount: 100, nature: 'ENTRETIEN' },
      { id: 'x', amount: 100, nature: 'ENTRETIEN' },
    ];
    const scoped = filterTransactionsForScope(rows, {}, natures);
    expect(scoped).toHaveLength(1);
    expect(computeTotalExpenses(scoped, natures)).toBe(100);
  });

  it('resolveTransactionKind : nature absente → signe', () => {
    expect(resolveTransactionKind({ id: 'z', amount: -40, nature: '' }, new Map())).toBe('expense');
    expect(resolveTransactionKind({ id: 'z', amount: 40, nature: '' }, new Map())).toBe('income');
  });

  it('période : sans accountingMonth, fallback date', () => {
    const t: TransactionLike = {
      id: 'd',
      amount: 10,
      nature: 'ENTRETIEN',
      date: '2024-02-15',
    };
    expect(isTransactionInAccountingPeriod(t, '2024-02', '2024-02')).toBe(true);
    expect(isTransactionInAccountingPeriod(t, '2024-03', '2024-04')).toBe(false);
  });
});
