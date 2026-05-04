import { describe, expect, it } from 'vitest';
import { buildPortfolioAccountAggregates, kindLabel } from '@/features/market/portfolio/portfolioAccountAggregates';
import type { PortfolioAccount, PortfolioOrder } from '@/features/market/portfolio/portfolioTypes';
import type { PortfolioPositionComputed } from '@/features/market/portfolio/portfolioTypes';

describe('buildPortfolioAccountAggregates', () => {
  it('agrège valeur, coût, lignes et ordres par compte', () => {
    const accounts: PortfolioAccount[] = [
      {
        id: 'a1',
        organizationId: 'o',
        name: 'PEA Test',
        kind: 'PEA',
        currency: 'EUR',
        createdAt: '',
        updatedAt: '',
      },
    ];
    const positions: PortfolioPositionComputed[] = [
      {
        accountId: 'a1',
        accountName: 'PEA Test',
        accountKind: 'PEA',
        assetSymbol: 'X',
        assetIsin: null,
        quantity: 2,
        averageCostPerUnit: 50,
        remainingCostBasis: 100,
        lastPrice: 60,
        lastPriceFetchedAt: null,
        priceStatus: 'fresh',
        marketValue: 120,
        indicativeValueAtCostEuro: 100,
        unrealizedPnLEuro: 20,
        unrealizedPnLPct: 20,
        realizedPnLEuro: 0,
        dividendsNet: 0,
        feesAllocated: 0,
        taxesAllocated: 0,
        warnings: [],
      },
    ];
    const orders: PortfolioOrder[] = [
      {
        id: 'o1',
        organizationId: 'o',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: new Date().toISOString(),
        quantity: 2,
        unitPrice: 50,
        grossAmount: 100,
        fees: 0,
        taxes: 0,
        currency: 'EUR',
        createdAt: '',
        updatedAt: '',
      },
    ];
    const rows = buildPortfolioAccountAggregates(accounts, positions, orders);
    expect(rows).toHaveLength(1);
    expect(rows[0].marketValueEuro).toBe(120);
    expect(rows[0].remainingCostBasisEuro).toBe(100);
    expect(rows[0].openPositionLines).toBe(1);
    expect(rows[0].orderCount).toBe(1);
  });

  it('compte sans position : zéros', () => {
    const accounts: PortfolioAccount[] = [
      {
        id: 'a1',
        organizationId: 'o',
        name: 'Vide',
        kind: 'PEA',
        currency: 'EUR',
        createdAt: '',
        updatedAt: '',
      },
    ];
    const rows = buildPortfolioAccountAggregates(accounts, [], []);
    expect(rows[0].marketValueEuro).toBe(0);
    expect(rows[0].openPositionLines).toBe(0);
    expect(rows[0].orderCount).toBe(0);
  });
});

describe('kindLabel', () => {
  it('CTO → Compte-titres', () => {
    expect(kindLabel('CTO')).toBe('Compte-titres');
  });
});
