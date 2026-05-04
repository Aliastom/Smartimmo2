import { describe, expect, it } from 'vitest';
import { investmentActionLogToJournalEntry, journalEntryBadgeLabels } from '@/features/market/services/investmentJournalMapper';
import type { InvestmentActionLog } from '@/features/market/types';

function baseLog(overrides: Partial<InvestmentActionLog> = {}): InvestmentActionLog {
  return {
    id: 'l1',
    organizationId: 'o1',
    date: new Date().toISOString(),
    type: 'DCA',
    recommendedAmount: 300,
    validatedAmount: 300,
    cashBefore: 1000,
    cashAfter: 700,
    reason: 'test',
    drawdownAtDecision: -5,
    athPriceAtDecision: 10,
    currentPriceAtDecision: 9,
    symbolAtDecision: 'X',
    marketStatusAtDecision: 'NORMAL',
    athPeriodAtDecision: 'MAX',
    status: 'validated',
    ...overrides,
  };
}

describe('investmentJournalMapper', () => {
  it('passe de pending (suggested) à libellé cohérent', () => {
    const v = investmentActionLogToJournalEntry(baseLog({ status: 'suggested' }));
    expect(v.status).toBe('pending');
    expect(journalEntryBadgeLabels(v).primary).toBe('Recommandation');
  });

  it('validé + orderId : badge ordre créé', () => {
    const v = investmentActionLogToJournalEntry(
      baseLog({ portfolioOrderId: 'ord-1', status: 'validated' })
    );
    expect(v.orderId).toBe('ord-1');
    expect(journalEntryBadgeLabels(v).primary).toBe('Ordre créé');
  });

  it('ignoré : aucun ordre', () => {
    const v = investmentActionLogToJournalEntry(baseLog({ status: 'ignored', validatedAmount: 0 }));
    expect(v.status).toBe('ignored');
    expect(v.orderId).toBeNull();
  });
});
