import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvestmentSettings } from '@/features/market/types';
import * as marketOrderSymbolPrice from '@/features/market/services/marketOrderSymbolPrice';
import * as marketOrderSymbolSearch from '@/features/market/services/marketOrderSymbolSearch';
import * as marketSymbolSearchOnline from '@/features/market/services/marketSymbolSearchOnline';
import { resolveMarketAsset } from '@/features/market/services/resolveMarketAsset';

const settings: InvestmentSettings = {
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

describe('resolveMarketAsset', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(marketOrderSymbolPrice, 'getLastKnownUnitPriceForOrder').mockResolvedValue(123.45);
    vi.spyOn(marketSymbolSearchOnline, 'fetchYahooSearchQuotesRaw').mockResolvedValue([]);
  });

  it('CW8.PA → ticker local + prix snapshot', async () => {
    const r = await resolveMarketAsset({
      query: 'CW8.PA',
      organizationId: 'o1',
      investmentSettings: settings,
    });
    expect(r.status).toBe('resolved');
    if (r.status !== 'resolved') return;
    expect(r.asset.pricingSymbol).toBe('CW8.PA');
    expect(r.asset.lastPrice).toBe(123.45);
    expect(r.asset.confidence).toBe('high');
    expect(r.asset.priceSource).toBe('local_snapshot');
  });

  it('LU2655993207 référentiel local → pricingSymbol MWRD.PA + snapshot (sans Yahoo)', async () => {
    const fetchYahoo = vi.spyOn(marketSymbolSearchOnline, 'fetchYahooSearchQuotesRaw');
    const r = await resolveMarketAsset({
      query: 'LU2655993207',
      organizationId: 'o1',
      investmentSettings: settings,
    });
    expect(fetchYahoo).not.toHaveBeenCalled();
    expect(marketOrderSymbolPrice.getLastKnownUnitPriceForOrder).toHaveBeenCalledWith(
      'o1',
      'MWRD.PA',
      settings.athPeriod,
    );
    expect(r.status).toBe('resolved');
    if (r.status !== 'resolved') return;
    expect(r.asset.pricingSymbol).toBe('MWRD.PA');
    expect(r.asset.isin).toBe('LU2655993207');
    expect(r.asset.lastPrice).toBe(123.45);
    expect(r.asset.confidence).toBe('high');
  });

  it('LU2655993207 sans champ isin Yahoo mais EUR + Euronext + nom fort → ticker résolu', async () => {
    vi.spyOn(marketOrderSymbolSearch, 'buildMarketOrderSymbolCandidates').mockReturnValue([
      {
        tier: 'local_extension',
        storageSymbol: 'LU2655993207',
        name: 'Amundi MSCI World Swap UCITS ETF EUR Dist',
        isin: 'LU2655993207',
        currency: 'EUR',
        exchange: 'Euronext Paris',
        expectNoAutoPrice: true,
      },
    ]);
    vi.spyOn(marketSymbolSearchOnline, 'fetchYahooSearchQuotesRaw').mockResolvedValue([
      {
        symbol: 'MWRD.PA',
        longname: 'Amundi MSCI World Swap UCITS ETF EUR Dist',
        exchange: 'EURONEXT PARIS',
        currency: 'EUR',
        regularMarketPrice: 36.6,
      },
    ]);

    const r = await resolveMarketAsset({
      query: 'LU2655993207',
      organizationId: 'o1',
      investmentSettings: settings,
    });
    expect(r.status).toBe('resolved');
    if (r.status !== 'resolved') return;
    expect(r.asset.pricingSymbol).toBe('MWRD.PA');
    expect(r.asset.lastPrice).toBe(36.6);
    expect(r.asset.confidence).toBe('medium');
  });

  it('LU2655993207 avec quote Yahoo ISIN exact → pricingSymbol + prix quote', async () => {
    vi.spyOn(marketOrderSymbolSearch, 'buildMarketOrderSymbolCandidates').mockReturnValue([]);
    vi.spyOn(marketSymbolSearchOnline, 'fetchYahooSearchQuotesRaw').mockResolvedValue([
      {
        symbol: 'MWRD.PA',
        longname: 'Amundi MSCI World Swap UCITS ETF EUR Dist',
        exchange: 'PAR',
        currency: 'EUR',
        isin: 'LU2655993207',
        regularMarketPrice: 36.6,
      },
    ]);

    const r = await resolveMarketAsset({
      query: 'LU2655993207',
      organizationId: 'o1',
      investmentSettings: settings,
    });
    expect(r.status).toBe('resolved');
    if (r.status !== 'resolved') return;
    expect(r.asset.pricingSymbol).toBe('MWRD.PA');
    expect(r.asset.isin).toBe('LU2655993207');
    expect(r.asset.lastPrice).toBe(36.6);
  });

  it('plusieurs quotes avec même ISIN → ambigu', async () => {
    vi.spyOn(marketOrderSymbolSearch, 'buildMarketOrderSymbolCandidates').mockReturnValue([]);
    vi.spyOn(marketSymbolSearchOnline, 'fetchYahooSearchQuotesRaw').mockResolvedValue([
      {
        symbol: 'AAA.PA',
        longname: 'Test A',
        isin: 'LU2655993207',
        regularMarketPrice: 1,
      },
      {
        symbol: 'BBB.PA',
        longname: 'Test B',
        isin: 'LU2655993207',
        regularMarketPrice: 2,
      },
    ]);

    const r = await resolveMarketAsset({
      query: 'LU2655993207',
      organizationId: 'o1',
      investmentSettings: settings,
    });
    expect(r.status).toBe('ambiguous');
    if (r.status !== 'ambiguous') return;
    expect(r.candidates.length).toBeGreaterThanOrEqual(2);
  });
});
