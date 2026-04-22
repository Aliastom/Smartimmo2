import { describe, expect, it } from 'vitest';
import { Fiscal2044Aggregator } from '@/services/tax/Fiscal2044Aggregator';

describe('Fiscal2044Aggregator - forfait fiscal ligne 222', () => {
  it('applique 20€ pour 1 lot loué', () => {
    const result = Fiscal2044Aggregator.aggregate({
      propertyId: 'p1',
      year: 2025,
      transactions: [],
      interetsEmprunt: 0,
      rentedLotCount: 1,
      applyForfait222: true,
    });

    expect(result.lines['222']).toBe(20);
    expect(result.lines['229']).toBe(20);
    expect(result.lines['420']).toBe(-20);
    expect(result.uiLineUsageTrace?.['222']?.isSynthetic).toBe(true);
    expect(result.uiLineUsageTrace?.['222']?.syntheticUnits).toBe(1);
  });

  it('applique 40€ pour 2 lots loués', () => {
    const result = Fiscal2044Aggregator.aggregate({
      propertyId: 'p2',
      year: 2025,
      transactions: [],
      interetsEmprunt: 0,
      rentedLotCount: 2,
      applyForfait222: true,
    });

    expect(result.lines['222']).toBe(40);
    expect(result.lines['229']).toBe(40);
    expect(result.lines['420']).toBe(-40);
    expect(result.uiLineUsageTrace?.['222']?.transactionIds).toEqual(['FORFAIT_222_p2']);
    expect(result.uiLineUsageTrace?.['222']?.labels[0]).toContain('2 lot(s)');
  });

  it('n’applique rien quand le forfait est désactivé (micro / LMNP)', () => {
    const result = Fiscal2044Aggregator.aggregate({
      propertyId: 'p3',
      year: 2025,
      transactions: [],
      interetsEmprunt: 0,
      rentedLotCount: 2,
      applyForfait222: false,
    });

    expect(result.lines['222']).toBe(0);
    expect(result.uiLineUsageTrace?.['222']?.amountFromTransactions || 0).toBe(0);
  });
});

