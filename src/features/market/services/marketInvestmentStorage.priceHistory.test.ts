import { afterEach, describe, expect, it } from 'vitest';
import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';
import type { MarketHistoryPoint } from '@/features/market/services/marketDataService';

const sampleHistory = (symbol: string): MarketHistoryPoint[] => [
  { date: '2024-01-02', close: 100, high: 101 },
  { date: '2024-01-03', close: 101 + symbol.length, high: 102 },
];

describe('marketInvestmentStorage price history (localStorage)', () => {
  afterEach(() => {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k?.startsWith('smartimmo.market.history:')) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  });

  it('isole organizationId, symbol et athPeriod dans la clé', () => {
    marketInvestmentStorage.savePriceHistory('org-a', 'CW8.PA', 'MAX', sampleHistory('CW8'));
    marketInvestmentStorage.savePriceHistory('org-b', 'CW8.PA', 'MAX', sampleHistory('B'));
    marketInvestmentStorage.savePriceHistory('org-a', 'EWLD.PA', 'MAX', sampleHistory('EWLD'));
    marketInvestmentStorage.savePriceHistory('org-a', 'CW8.PA', '5Y', sampleHistory('5Y'));

    expect(marketInvestmentStorage.getPriceHistory('org-a', 'CW8.PA', 'MAX').length).toBe(2);
    expect(marketInvestmentStorage.getPriceHistory('org-b', 'CW8.PA', 'MAX')[1]?.close).toBe(101 + 'B'.length);
    expect(marketInvestmentStorage.getPriceHistory('org-a', 'EWLD.PA', 'MAX')[1]?.close).toBe(101 + 'EWLD'.length);
    expect(marketInvestmentStorage.getPriceHistory('org-a', 'CW8.PA', '5Y')[1]?.close).toBe(101 + '5Y'.length);
  });
});
