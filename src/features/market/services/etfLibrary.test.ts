import { describe, expect, it } from 'vitest';
import {
  ETF_LIBRARY,
  computeEtfQualityScore,
  isFullLibraryMarketRefreshable,
  isTrackableMarketAsset,
  isTrackedEtf,
} from '@/features/market/services/etfLibrary';

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
    const crypto = ETF_LIBRARY.find((item) => item.id === 'coinshares-physical-bitcoin-etn');
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

  it('respecte les règles de rôle par classe/catégorie', () => {
    const cryptoRows = ETF_LIBRARY.filter((item) => item.assetClass === 'ETN_CRYPTO');
    expect(cryptoRows.length).toBeGreaterThan(0);
    expect(cryptoRows.every((item) => item.portfolioRole === 'SPECULATIF')).toBe(true);

    const sectorRows = ETF_LIBRARY.filter((item) => item.category === 'SECTORIEL');
    expect(sectorRows.every((item) => item.portfolioRole !== 'PILIER')).toBe(true);

    const coreRows = ETF_LIBRARY.filter((item) => item.category === 'WORLD' || item.category === 'SP500');
    expect(coreRows.some((item) => item.portfolioRole === 'PILIER')).toBe(true);

    const diversRows = ETF_LIBRARY.filter((item) => item.category === 'OBLIGATIONS' || item.category === 'OR');
    expect(diversRows.every((item) => item.portfolioRole === 'DIVERSIFICATION')).toBe(true);
  });

  it('n’autorise pas le suivi marché pour les actifs non cotés ETF-like', () => {
    const nonTrackable = ETF_LIBRARY.filter(
      (item) => item.assetClass === 'SCPI' || item.assetClass === 'PRIVATE_EQUITY' || item.assetClass === 'FONDS_DATE'
    );
    expect(nonTrackable.length).toBeGreaterThan(0);
    expect(nonTrackable.every((item) => !isTrackableMarketAsset(item.assetClass))).toBe(true);
  });

  it('isFullLibraryMarketRefreshable exclut SCPI / PE / fonds datés et la crypto par défaut', () => {
    const bitcoin = ETF_LIBRARY.find((item) => item.id === 'coinshares-physical-bitcoin-etn');
    const world = ETF_LIBRARY.find((item) => item.id === 'ishares-core-msci-world-eunl');
    const scpi = ETF_LIBRARY.find((item) => item.assetClass === 'SCPI');
    expect(bitcoin).toBeTruthy();
    expect(world).toBeTruthy();
    expect(scpi).toBeTruthy();
    if (!bitcoin || !world || !scpi) return;
    expect(isFullLibraryMarketRefreshable(bitcoin)).toBe(false);
    expect(isFullLibraryMarketRefreshable(bitcoin, { excludeCrypto: false })).toBe(true);
    expect(isFullLibraryMarketRefreshable(world)).toBe(true);
    expect(isFullLibraryMarketRefreshable(scpi)).toBe(false);
  });
});
