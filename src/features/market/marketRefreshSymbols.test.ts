import { describe, expect, it } from 'vitest';
import {
  buildFullTrackableLibrarySymbols,
  buildMarketRefreshSymbols,
  buildMarketSnapshotKeepSet,
  countFullMarketRefreshSymbols,
  mergeUniqueMarketRefreshSymbols,
  readMarketCompareSymbols,
  readRecentPrincipalSymbols,
} from '@/features/market/marketRefreshSymbols';
import { normalizeMarketStorageSymbol } from '@/features/market/marketSymbolAliases';
import type { InvestmentSettings } from '@/features/market/types';

function minimalSettings(overrides: Partial<InvestmentSettings>): InvestmentSettings {
  return {
    id: 's1',
    organizationId: 'org1',
    referenceSymbol: 'CW8.PA',
    referenceLabel: 'Test',
    envelope: 'PEA',
    athPeriod: 'MAX',
    availableCash: 0,
    monthlyDcaAmount: 0,
    reinforce10Threshold: -10,
    reinforce20Threshold: -20,
    reinforce10Amount: 0,
    reinforce20Amount: 0,
    strategy: 'DCA_PLUS_REINFORCE',
    cashReferenceAmount: 0,
    currency: 'EUR',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildMarketSnapshotKeepSet', () => {
  it('inclut le périmètre refresh (radar + principal) une fois normalisé', () => {
    const settings = minimalSettings({ referenceSymbol: 'EUNL.DE' });
    const set = buildMarketSnapshotKeepSet(settings, 'org-test', ['CW8.PA', 'EWLD.PA']);
    expect(set.has('CW8.PA')).toBe(true);
    expect(set.has('EWLD.PA')).toBe(true);
    expect(set.has('EUNL.DE')).toBe(true);
  });
});

describe('buildMarketRefreshSymbols', () => {
  it('fusionne radar, principal, comparaisons et récents sans doublon', () => {
    const settings = minimalSettings({ referenceSymbol: 'cw8.pa', referenceLabel: 'Amundi' });
    const list = buildMarketRefreshSymbols(settings, ['CW8.PA', 'EWLD.PA'], ['EWLD.PA', 'FOO.PA'], ['cw8.pa', 'BAR.PA']);
    expect(list).toEqual(['CW8.PA', 'EWLD.PA', 'FOO.PA', 'BAR.PA']);
  });

  it('inclut toujours le symbole principal même hors radar', () => {
    const settings = minimalSettings({ referenceSymbol: 'EUNL.DE', referenceLabel: 'MSCI World' });
    const list = buildMarketRefreshSymbols(settings, ['CW8.PA'], [], []);
    expect(list).toEqual(['CW8.PA', 'EUNL.DE']);
  });
});

describe('mergeUniqueMarketRefreshSymbols', () => {
  it('dédoublonne en conservant l’ordre de première apparition', () => {
    expect(mergeUniqueMarketRefreshSymbols([['AAA', 'BBB'], ['BBB', 'CCC'], ['AAA']])).toEqual(['AAA', 'BBB', 'CCC']);
  });
});

describe('buildFullTrackableLibrarySymbols', () => {
  it('exclut SCPI, private equity et fonds datés', () => {
    const list = buildFullTrackableLibrarySymbols({ excludeCrypto: true });
    const norms = new Set(list.map((s) => normalizeMarketStorageSymbol(s)));
    expect(norms.has(normalizeMarketStorageSymbol('SCPI-PRIMOVIE'))).toBe(false);
    expect(norms.has(normalizeMarketStorageSymbol('PE-BXPE'))).toBe(false);
    expect(norms.has(normalizeMarketStorageSymbol('FD-2030'))).toBe(false);
  });

  it('exclut la crypto par défaut', () => {
    const list = buildFullTrackableLibrarySymbols({ excludeCrypto: true });
    expect(list).not.toContain('BITC.SW');
    expect(list).not.toContain('ETHE.SW');
    expect(list.length).toBeGreaterThan(5);
  });

  it('peut inclure la crypto si excludeCrypto est false', () => {
    const withCrypto = buildFullTrackableLibrarySymbols({ excludeCrypto: false });
    const withoutCrypto = buildFullTrackableLibrarySymbols({ excludeCrypto: true });
    expect(withCrypto).toContain('BITC.SW');
    expect(withCrypto.length).toBeGreaterThan(withoutCrypto.length);
  });
});

describe('countFullMarketRefreshSymbols', () => {
  it('compte le périmètre fusionné standard + bibliothèque', () => {
    const settings = minimalSettings({ referenceSymbol: 'ZZZ.PA', referenceLabel: 'Test' });
    const n = countFullMarketRefreshSymbols(settings, 'org-x', ['CW8.PA']);
    const libOnly = buildFullTrackableLibrarySymbols({ excludeCrypto: true }).length;
    expect(n).toBeGreaterThanOrEqual(libOnly);
  });

  it('aligne le décompte UI (bouton Actualiser les données marché) sur merge(standard, catalogue) pour la même org', () => {
    const org = `vitest-lib-scope-${Date.now()}`;
    const settings = minimalSettings({ referenceSymbol: 'CW8.PA', referenceLabel: 'Test' });
    const radar = ['CW8.PA', 'EWLD.PA'];
    const recent = readRecentPrincipalSymbols(org).map((e) => e.symbol);
    const compared = readMarketCompareSymbols(org);
    const standard = buildMarketRefreshSymbols(settings, radar, compared, recent);
    const lib = buildFullTrackableLibrarySymbols({ excludeCrypto: true });
    expect(countFullMarketRefreshSymbols(settings, org, radar)).toBe(
      mergeUniqueMarketRefreshSymbols([standard, lib]).length
    );
  });
});

describe('périmètre refresh standard vs bibliothèque', () => {
  it('le refresh standard (symboles seuls) ne couvre pas tout le catalogue trackable', () => {
    const settings = minimalSettings({ referenceSymbol: 'CW8.PA', referenceLabel: 'Test' });
    const standard = buildMarketRefreshSymbols(settings, ['CW8.PA', 'EWLD.PA'], [], []);
    const lib = buildFullTrackableLibrarySymbols({ excludeCrypto: true });
    const onlyInCatalogue = lib.filter((s) => !standard.includes(s));
    expect(onlyInCatalogue.length).toBeGreaterThan(0);
  });
});
