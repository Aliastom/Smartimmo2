import { describe, expect, it } from 'vitest';
import {
  buildMarketOrderSymbolCandidates,
  filterSymbolSearchCandidates,
  formatSymbolSearchLine,
  isSymbolRecognizedInCatalog,
  normalizeSearchIsin,
} from '@/features/market/services/marketOrderSymbolSearch';
import type { InvestmentSettings } from '@/features/market/types';
import type { PortfolioOrder } from '@/features/market/portfolio/portfolioTypes';

describe('marketOrderSymbolSearch', () => {
  const principalSettings: InvestmentSettings = {
    id: 'default',
    organizationId: 'o1',
    referenceSymbol: 'CW8.PA',
    referenceLabel: 'Amundi MSCI World UCITS ETF',
    envelope: 'PEA',
    athPeriod: 'MAX',
    availableCash: 1000,
    monthlyDcaAmount: 100,
    monthlyInvestmentDay: 5,
    reinforce10Threshold: -10,
    reinforce20Threshold: -20,
    reinforce10Amount: 100,
    reinforce20Amount: 200,
    strategy: 'DCA_PLUS_REINFORCE',
    cashReferenceAmount: 1000,
    currency: 'EUR',
    updatedAt: new Date().toISOString(),
    peaSocialContributionsOnGainsRate: 0.172,
    investmentStrategy: { monthlyDca: 100, reinforceLevels: [] },
  };

  it('buildMarketOrderSymbolCandidates : principal avant radar (EWLD.PA vient du radar)', () => {
    const list = buildMarketOrderSymbolCandidates(principalSettings);
    const idxCw8 = list.findIndex((c) => c.storageSymbol.toUpperCase() === 'CW8.PA');
    const idxEwld = list.findIndex((c) => c.storageSymbol.toUpperCase() === 'EWLD.PA');
    expect(idxCw8).toBeGreaterThanOrEqual(0);
    expect(idxEwld).toBeGreaterThanOrEqual(0);
    expect(idxCw8).toBeLessThan(idxEwld);
    expect(list[idxCw8]?.tier).toBe('principal');
    expect(list[idxEwld]?.tier).toBe('radar');
  });

  it('filterSymbolSearchCandidates : ticker et nom, insensible à la casse', () => {
    const list = buildMarketOrderSymbolCandidates(principalSettings);
    const byTicker = filterSymbolSearchCandidates(list, 'cw8');
    expect(byTicker.some((c) => c.storageSymbol.toUpperCase().includes('CW8'))).toBe(true);
    const byName = filterSymbolSearchCandidates(list, 'AMUNDI MSCI');
    expect(byName.length).toBeGreaterThan(0);
    expect(byName[0]?.name.toLowerCase()).toContain('amundi');
  });

  it('formatSymbolSearchLine : affichage « TICKER — Nom »', () => {
    const list = buildMarketOrderSymbolCandidates(principalSettings);
    const cw8 = list.find((c) => c.storageSymbol.toUpperCase() === 'CW8.PA');
    expect(cw8).toBeDefined();
    expect(formatSymbolSearchLine(cw8!)).toMatch(/CW8\.PA — .+/);
  });

  it('isSymbolRecognizedInCatalog : connu vs inconnu (fallback saisie libre)', () => {
    const list = buildMarketOrderSymbolCandidates(principalSettings);
    expect(isSymbolRecognizedInCatalog('CW8.PA', list)).toBe(true);
    expect(isSymbolRecognizedInCatalog('TOTALLY_UNKNOWN_XYZ', list)).toBe(false);
  });

  it('recherche « CW8 » trouve CW8.PA', () => {
    const list = buildMarketOrderSymbolCandidates(principalSettings);
    const hits = filterSymbolSearchCandidates(list, 'CW8');
    expect(hits.some((c) => c.storageSymbol.toUpperCase() === 'CW8.PA')).toBe(true);
  });

  it('recherche ISIN LU2655993207 : entrée locale dédiée', () => {
    const list = buildMarketOrderSymbolCandidates(principalSettings);
    expect(normalizeSearchIsin('LU2655993207')).toBe('LU2655993207');
    const hits = filterSymbolSearchCandidates(list, 'LU2655993207');
    expect(hits.some((c) => c.isin === 'LU2655993207')).toBe(true);
    expect(isSymbolRecognizedInCatalog('LU2655993207', list)).toBe(true);
    const lu = list.find((c) => c.isin === 'LU2655993207');
    expect(lu?.pricingSymbol).toBe('MWRD.PA');
    expect(formatSymbolSearchLine(lu!)).toContain('cotation MWRD.PA');
  });

  it('symboles issus des ordres récents apparaissent dans le catalogue', () => {
    const orders: PortfolioOrder[] = [
      {
        id: 'o1',
        organizationId: 'o1',
        accountId: 'a1',
        assetSymbol: 'ACME.PA',
        assetIsin: 'FR0000000001',
        type: 'BUY',
        date: '2026-01-02T12:00:00.000Z',
        quantity: 1,
        unitPrice: 10,
        grossAmount: 10,
        fees: 0,
        taxes: 0,
        currency: 'EUR',
        createdAt: '2026-01-02',
        updatedAt: '2026-01-02',
      },
    ];
    const list = buildMarketOrderSymbolCandidates(principalSettings, { recentOrders: orders });
    expect(list.some((c) => c.storageSymbol.toUpperCase() === 'ACME.PA')).toBe(true);
  });
});
