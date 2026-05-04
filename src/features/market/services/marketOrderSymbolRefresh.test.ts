import { beforeEach, describe, expect, it, vi } from 'vitest';
import { marketDataService } from '@/features/market/services/marketDataService';
import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';
import { fetchPersistMarketPriceForSymbol } from '@/features/market/services/marketOrderSymbolRefresh';

vi.mock('@/features/market/services/marketDataService', () => ({
  marketDataService: {
    fetchYahooMarketBundle: vi.fn(),
  },
}));

vi.mock('@/features/market/services/marketInvestmentStorage', () => ({
  marketInvestmentStorage: {
    saveSnapshot: vi.fn(),
    savePriceHistory: vi.fn(),
  },
}));

describe('fetchPersistMarketPriceForSymbol', () => {
  beforeEach(() => {
    vi.mocked(marketDataService.fetchYahooMarketBundle).mockReset();
    vi.mocked(marketInvestmentStorage.saveSnapshot).mockReset();
    vi.mocked(marketInvestmentStorage.savePriceHistory).mockReset();
  });

  it('récupère le bundle, persiste et retourne le prix', async () => {
    vi.mocked(marketDataService.fetchYahooMarketBundle).mockResolvedValue({
      currentPrice: 99.5,
      athPrice: 120,
      athDate: '2020-01-01',
      drawdownPercent: -5,
      history: [{ date: '2024-01-01', close: 99.5 }],
    });
    const r = await fetchPersistMarketPriceForSymbol('org-1', 'CW8.PA', 'MAX');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.price).toBe(99.5);
    expect(marketInvestmentStorage.saveSnapshot).toHaveBeenCalled();
    expect(marketInvestmentStorage.savePriceHistory).toHaveBeenCalled();
  });

  it('retourne une erreur claire si le bundle est absent', async () => {
    vi.mocked(marketDataService.fetchYahooMarketBundle).mockResolvedValue(null);
    const r = await fetchPersistMarketPriceForSymbol('org-1', 'XX.PA', 'MAX');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/indisponible/i);
  });
});
