import { describe, expect, it } from 'vitest';
import { marketSnapshotCacheKey, normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';

describe('marché: clés cache / réhydratation', () => {
  it('normalise la casse pour aligner Dexie et radarMap', () => {
    expect(normalizeMarketStorageSymbol('cw8.pa')).toBe('CW8.PA');
    expect(normalizeMarketStorageSymbol('  eunl.de ')).toBe('EUNL.DE');
  });

  it('marketSnapshotCacheKey est stable pour le même actif (casse)', () => {
    const ath = 'MAX' as const;
    expect(marketSnapshotCacheKey('CW8.PA', ath)).toBe(marketSnapshotCacheKey('cw8.pa', ath));
  });
});
