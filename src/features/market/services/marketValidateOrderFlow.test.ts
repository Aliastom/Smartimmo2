import { describe, expect, it } from 'vitest';
import {
  buildJournalMarketContext,
  canValidateLocalBuyOrder,
  computeBuyQuantity,
  mapDecisionTypeToRecommendationKind,
  pickDefaultPortfolioAccount,
  resolveUnitPriceForValidation,
} from '@/features/market/services/marketValidateOrderFlow';
import type { PortfolioAccount } from '@/features/market/portfolio/portfolioTypes';
import type { InvestmentSettings, MarketSnapshot } from '@/features/market/types';

function makeSettings(overrides: Partial<InvestmentSettings> = {}): InvestmentSettings {
  return {
    id: 'default',
    organizationId: 'org',
    referenceSymbol: 'CW8.PA',
    referenceLabel: 'Test',
    envelope: 'PEA',
    athPeriod: 'MAX',
    availableCash: 5000,
    monthlyDcaAmount: 300,
    reinforce10Threshold: -10,
    reinforce20Threshold: -20,
    reinforce10Amount: 0,
    reinforce20Amount: 0,
    strategy: 'DCA_PLUS_REINFORCE',
    cashReferenceAmount: 5000,
    currency: 'EUR',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('marketValidateOrderFlow', () => {
  it('pickDefaultPortfolioAccount préfère l’enveloppe PEA', () => {
    const accounts: PortfolioAccount[] = [
      {
        id: 'c',
        organizationId: 'org',
        name: 'CTO',
        kind: 'CTO',
        currency: 'EUR',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'p',
        organizationId: 'org',
        name: 'PEA',
        kind: 'PEA',
        currency: 'EUR',
        createdAt: '',
        updatedAt: '',
      },
    ];
    expect(pickDefaultPortfolioAccount(accounts, 'PEA')).toBe('p');
  });

  it('mapDecisionTypeToRecommendationKind', () => {
    expect(mapDecisionTypeToRecommendationKind('DCA_ONLY')).toBe('DCA');
    expect(mapDecisionTypeToRecommendationKind('STRONG_REINFORCE')).toBe('REINFORCE');
  });

  it('resolveUnitPriceForValidation : manuel > snapshot', () => {
    const snap: MarketSnapshot = {
      id: '1',
      organizationId: 'o',
      symbol: 'X',
      athPeriod: 'MAX',
      currentPrice: 10,
      athPrice: 12,
      drawdownPercent: -5,
      fetchedAt: '',
      source: 't',
    };
    expect(resolveUnitPriceForValidation(snap, 9)).toBe(9);
    expect(resolveUnitPriceForValidation(snap, null)).toBe(10);
  });

  it('canValidateLocalBuyOrder bloque sans prix, sans compte, montant nul', () => {
    expect(canValidateLocalBuyOrder({ amountEuro: 100, unitPrice: null, accountId: 'a' })).toMatchObject({
      ok: false,
      reason: 'missing_price',
    });
    expect(canValidateLocalBuyOrder({ amountEuro: 100, unitPrice: 5, accountId: null })).toMatchObject({
      ok: false,
      reason: 'no_account',
    });
    expect(canValidateLocalBuyOrder({ amountEuro: 0, unitPrice: 5, accountId: 'a' })).toMatchObject({
      ok: false,
      reason: 'zero_amount',
    });
  });

  it('computeBuyQuantity', () => {
    expect(computeBuyQuantity(100, 25)).toBe(4);
  });

  it('buildJournalMarketContext', () => {
    const s = makeSettings();
    const snap: MarketSnapshot = {
      id: '1',
      organizationId: 'o',
      symbol: 'X',
      athPeriod: 'MAX',
      currentPrice: 3,
      athPrice: 4,
      drawdownPercent: -7,
      fetchedAt: '',
      source: 't',
    };
    const ctx = buildJournalMarketContext(snap, s);
    expect(ctx.price).toBe(3);
    expect(ctx.cashAvailable).toBe(5000);
  });
});
