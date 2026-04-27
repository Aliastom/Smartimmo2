import { describe, expect, it } from 'vitest';
import { ETF_LIBRARY, computeEtfQualityScore, isTrackedEtf } from '@/features/market/services/etfLibrary';

describe('etfLibrary', () => {
  it('calcule un score qualité borné entre 0 et 100', () => {
    for (const item of ETF_LIBRARY) {
      const result = computeEtfQualityScore(item);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    }
  });

  it('favorise un ETF large cap efficient', () => {
    const world = ETF_LIBRARY.find((item) => item.id === 'ishares-core-msci-world-eunl');
    const crypto = ETF_LIBRARY.find((item) => item.id === 'coinshares-physical-bitcoin');
    expect(world).toBeTruthy();
    expect(crypto).toBeTruthy();
    if (!world || !crypto) return;
    expect(computeEtfQualityScore(world).score).toBeGreaterThan(computeEtfQualityScore(crypto).score);
  });

  it('détecte correctement l’ETF suivi', () => {
    const item = ETF_LIBRARY[0];
    expect(item).toBeTruthy();
    if (!item) return;
    expect(isTrackedEtf(item, item.ticker.toLowerCase())).toBe(true);
    expect(isTrackedEtf(item, 'SPY')).toBe(false);
  });
});
