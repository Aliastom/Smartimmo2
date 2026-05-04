import { beforeEach, describe, expect, it, vi } from 'vitest';
import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';
import { getLastKnownUnitPriceForOrder, resolveAutoOrderUnitPrice } from '@/features/market/services/marketOrderSymbolPrice';

vi.mock('@/features/market/services/marketInvestmentStorage', () => ({
  marketInvestmentStorage: {
    getSnapshot: vi.fn(),
    getPriceHistory: vi.fn(() => []),
  },
}));

describe('getLastKnownUnitPriceForOrder', () => {
  beforeEach(() => {
    vi.mocked(marketInvestmentStorage.getSnapshot).mockReset();
    vi.mocked(marketInvestmentStorage.getPriceHistory).mockReset();
    vi.mocked(marketInvestmentStorage.getPriceHistory).mockReturnValue([]);
  });

  it('retourne le cours du snapshot local (cache Dexie)', async () => {
    vi.mocked(marketInvestmentStorage.getSnapshot).mockResolvedValue({
      currentPrice: 42.5,
    } as Awaited<ReturnType<typeof marketInvestmentStorage.getSnapshot>>);
    const p = await getLastKnownUnitPriceForOrder('org', 'CW8.PA', 'MAX');
    expect(p).toBe(42.5);
  });

  it('retourne null si pas de cours', async () => {
    vi.mocked(marketInvestmentStorage.getSnapshot).mockResolvedValue({ currentPrice: null } as Awaited<
      ReturnType<typeof marketInvestmentStorage.getSnapshot>
    >);
    const p = await getLastKnownUnitPriceForOrder('org', 'XX', 'MAX');
    expect(p).toBeNull();
  });

  it('deux symboles distincts → deux cours distincts (pas de mélange)', async () => {
    vi.mocked(marketInvestmentStorage.getSnapshot)
      .mockResolvedValueOnce({ currentPrice: 10 } as Awaited<ReturnType<typeof marketInvestmentStorage.getSnapshot>>)
      .mockResolvedValueOnce({ currentPrice: 22 } as Awaited<ReturnType<typeof marketInvestmentStorage.getSnapshot>>);
    const a = await getLastKnownUnitPriceForOrder('org', 'CW8.PA', 'MAX');
    const b = await getLastKnownUnitPriceForOrder('org', 'WPEA.PA', 'MAX');
    expect(a).toBe(10);
    expect(b).toBe(22);
  });
});

describe('resolveAutoOrderUnitPrice', () => {
  beforeEach(() => {
    vi.mocked(marketInvestmentStorage.getSnapshot).mockReset();
    vi.mocked(marketInvestmentStorage.getPriceHistory).mockReset();
    vi.mocked(marketInvestmentStorage.getPriceHistory).mockReturnValue([]);
  });

  function todayYmd(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  it('date du jour → cours actuel (snapshot cache), sans repli historique', async () => {
    vi.mocked(marketInvestmentStorage.getSnapshot).mockResolvedValue({
      currentPrice: 99,
    } as Awaited<ReturnType<typeof marketInvestmentStorage.getSnapshot>>);
    const r = await resolveAutoOrderUnitPrice({
      organizationId: 'org',
      symbol: 'CW8.PA',
      orderDateYmd: todayYmd(),
      athPeriod: 'MAX',
    });
    expect(r.source).toBe('market_cache');
    expect(r.unitPrice).toBe(99);
    expect(r.usedHistoryFallback).toBe(false);
  });

  it('date passée avec priceHistory → cours historique le plus proche', async () => {
    vi.mocked(marketInvestmentStorage.getPriceHistory).mockReturnValue([
      { date: '2024-06-01', close: 50 },
      { date: '2024-06-15', close: 55 },
    ]);
    vi.mocked(marketInvestmentStorage.getSnapshot).mockResolvedValue({
      currentPrice: 999,
    } as Awaited<ReturnType<typeof marketInvestmentStorage.getSnapshot>>);
    const r = await resolveAutoOrderUnitPrice({
      organizationId: 'org',
      symbol: 'CW8.PA',
      orderDateYmd: '2024-06-10',
      athPeriod: 'MAX',
    });
    expect(r.source).toBe('historical');
    expect(r.unitPrice).toBe(55);
    expect(r.historicalPointDate).toBe('2024-06-15');
  });

  it('date passée sans historique local → fallback dernier snapshot + flag repli', async () => {
    vi.mocked(marketInvestmentStorage.getPriceHistory).mockReturnValue([]);
    vi.mocked(marketInvestmentStorage.getSnapshot).mockResolvedValue({
      currentPrice: 12,
    } as Awaited<ReturnType<typeof marketInvestmentStorage.getSnapshot>>);
    const r = await resolveAutoOrderUnitPrice({
      organizationId: 'org',
      symbol: 'CW8.PA',
      orderDateYmd: '2020-01-01',
      athPeriod: 'MAX',
    });
    expect(r.source).toBe('market_cache');
    expect(r.unitPrice).toBe(12);
    expect(r.usedHistoryFallback).toBe(true);
  });
});
