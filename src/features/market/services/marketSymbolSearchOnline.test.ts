import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOnlineSymbolSearchCandidates } from '@/features/market/services/marketSymbolSearchOnline';

describe('fetchOnlineSymbolSearchCandidates', () => {
  const orig = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              quotes: [
                {
                  symbol: 'TEST.PA',
                  longname: 'Test ETF',
                  isin: 'LU0000000000',
                  exchange: 'PAR',
                  currency: 'EUR',
                  regularMarketPrice: 42.5,
                },
              ],
            }),
        })
      ) as unknown as typeof fetch
    );
  });

  afterEach(() => {
    globalThis.fetch = orig;
    vi.unstubAllGlobals();
  });

  it('mappe une quote Yahoo en candidat (prix connu)', async () => {
    const list = await fetchOnlineSymbolSearchCandidates('test');
    expect(list.length).toBe(1);
    expect(list[0]?.storageSymbol).toBe('TEST.PA');
    expect(list[0]?.lastPrice).toBe(42.5);
    expect(list[0]?.tier).toBe('online');
  });
});
