import { describe, expect, it } from 'vitest';
import {
  computePortfolioFromOrders,
  foldOrdersToLots,
  PORTFOLIO_PRICE_FRESH_MAX_MS,
  resolveGrossTransactionAmount,
} from '@/features/market/portfolio/portfolioLedgerEngine';
import type { PortfolioAccount, PortfolioOrder } from '@/features/market/portfolio/portfolioTypes';
import { surplusVsInflationEuro } from '@/features/market/portfolio/portfolioInflationEstimate';
import { estimatePortfolioTaxSimple } from '@/features/market/portfolio/portfolioFiscalEstimate';

const org = 'org1';
const nowIso = '2024-06-01T12:00:00.000Z';

function acc(id: string, kind: PortfolioAccount['kind'] = 'PEA'): PortfolioAccount {
  return {
    id,
    organizationId: org,
    name: `C ${id}`,
    kind,
    currency: 'EUR',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function order(p: Partial<PortfolioOrder> & Pick<PortfolioOrder, 'id' | 'type' | 'accountId' | 'assetSymbol' | 'date' | 'quantity'>): PortfolioOrder {
  return {
    organizationId: org,
    unitPrice: null,
    grossAmount: null,
    fees: 0,
    taxes: 0,
    currency: 'EUR',
    note: null,
    assetIsin: null,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...p,
  };
}

describe('portfolioLedgerEngine', () => {
  it('achat simple + valorisation', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'CW8.PA',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 10,
        unitPrice: 100,
        grossAmount: 1000,
        fees: 5,
      }),
    ];
    const { positions, totals } = computePortfolioFromOrders(accounts, orders, {
      bySymbol: { 'CW8.PA': 110 },
    });
    expect(positions).toHaveLength(1);
    expect(positions[0].remainingCostBasis).toBe(1005);
    expect(positions[0].quantity).toBe(10);
    expect(positions[0].marketValue).toBe(1100);
    expect(positions[0].unrealizedPnLEuro).toBe(95);
    expect(totals.grossPerformanceEuro).toBe(95);
  });

  it('achats multiples PRU moyen', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 10,
        grossAmount: 1000,
        fees: 0,
      }),
      order({
        id: '2',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2024-02-01T10:00:00.000Z',
        quantity: 10,
        grossAmount: 1200,
        fees: 0,
      }),
    ];
    const { positions } = computePortfolioFromOrders(accounts, orders, { bySymbol: { X: 120 } });
    const p = positions[0];
    expect(p.quantity).toBe(20);
    expect(p.remainingCostBasis).toBe(2200);
    expect(p.averageCostPerUnit).toBe(110);
    expect(p.marketValue).toBe(2400);
    expect(p.unrealizedPnLEuro).toBe(200);
  });

  it('vente partielle', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 10,
        grossAmount: 1000,
        fees: 0,
      }),
      order({
        id: '2',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'SELL',
        date: '2024-03-01T10:00:00.000Z',
        quantity: 4,
        grossAmount: 480,
        fees: 2,
        taxes: 0,
      }),
    ];
    const lots = foldOrdersToLots(orders);
    const k = [...lots.keys()].find((x) => x.includes('X'));
    const lot = lots.get(k!);
    expect(lot?.qty).toBe(6);
    expect(lot?.costBasis).toBe(600);
    const { totals } = computePortfolioFromOrders(accounts, orders, { bySymbol: { X: 100 } });
    expect(totals.totalRealizedPnL).toBe(78);
    expect(totals.totalRemainingCostBasis).toBe(600);
  });

  it('vente totale', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 5,
        grossAmount: 500,
        fees: 0,
      }),
      order({
        id: '2',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'SELL',
        date: '2024-02-01T10:00:00.000Z',
        quantity: 5,
        grossAmount: 600,
        fees: 1,
        taxes: 0,
      }),
    ];
    const { positions, totals, fiscalIncomeByKind } = computePortfolioFromOrders(accounts, orders, { bySymbol: { X: 100 } });
    expect(positions).toHaveLength(0);
    expect(totals.totalRealizedPnL).toBe(99);
    expect(totals.totalRemainingCostBasis).toBe(0);
    expect(fiscalIncomeByKind.PEA?.realized).toBe(99);
    expect(fiscalIncomeByKind.PEA?.unrealized).toBe(0);
  });

  it('fiscalIncomeByKind : dividendes après cession totale rattachés à l’enveloppe (ligne absente des positions ouvertes)', () => {
    const accounts = [acc('a1', 'CTO')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 1,
        grossAmount: 100,
        fees: 0,
      }),
      order({
        id: '2',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'SELL',
        date: '2024-02-01T10:00:00.000Z',
        quantity: 1,
        grossAmount: 110,
        fees: 0,
        taxes: 0,
      }),
      order({
        id: '3',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'DIVIDEND',
        date: '2024-03-01T10:00:00.000Z',
        quantity: 0,
        grossAmount: 20,
        taxes: 5,
        fees: 0,
      }),
    ];
    const { positions, fiscalIncomeByKind } = computePortfolioFromOrders(accounts, orders, { bySymbol: { X: 100 } });
    expect(positions).toHaveLength(0);
    expect(fiscalIncomeByKind.CTO?.realized).toBe(10);
    expect(fiscalIncomeByKind.CTO?.dividends).toBe(15);
    expect(fiscalIncomeByKind.CTO?.unrealized).toBe(0);
  });

  it('dividende sans changer PRU', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 10,
        grossAmount: 1000,
        fees: 0,
      }),
      order({
        id: '2',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'DIVIDEND',
        date: '2024-04-01T10:00:00.000Z',
        quantity: 0,
        grossAmount: 50,
        taxes: 15,
        fees: 0,
      }),
    ];
    const { positions, totals } = computePortfolioFromOrders(accounts, orders, { bySymbol: { X: 100 } });
    expect(positions[0].remainingCostBasis).toBe(1000);
    expect(positions[0].dividendsNet).toBe(35);
    expect(totals.totalDividendsNet).toBe(35);
    expect(totals.grossPerformanceEuro).toBe(35);
  });

  it('frais et taxe sur vente', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 10,
        grossAmount: 1000,
        fees: 10,
      }),
      order({
        id: '2',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'SELL',
        date: '2024-02-01T10:00:00.000Z',
        quantity: 10,
        grossAmount: 1200,
        fees: 5,
        taxes: 30,
      }),
    ];
    const { totals } = computePortfolioFromOrders(accounts, orders, { bySymbol: { X: 50 } });
    expect(totals.totalRealizedPnL).toBe(155);
    expect(totals.totalFees).toBeGreaterThan(0);
    expect(totals.totalTaxes).toBe(30);
  });

  it('prix manquant → pas de valeur mais ligne ouverte', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'Z',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 1,
        grossAmount: 100,
        fees: 0,
      }),
    ];
    const { positions } = computePortfolioFromOrders(accounts, orders, { bySymbol: {} });
    expect(positions[0].marketValue).toBeNull();
    expect(positions[0].warnings.some((w) => w.code === 'MISSING_PRICE_FOR_VALUATION')).toBe(true);
  });

  it('quantité négative signalée', () => {
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'SELL',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 1,
        grossAmount: 10,
        fees: 0,
      }),
    ];
    const lots = foldOrdersToLots(orders);
    const lot = [...lots.values()][0];
    expect(lot.warnings.some((w) => w.code === 'NEGATIVE_QUANTITY')).toBe(true);
  });

  it('vente au-delà du stock : prorata brut / frais / taxes sur la quantité réellement cédée', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 10,
        grossAmount: 1000,
        fees: 0,
      }),
      order({
        id: '2',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'SELL',
        date: '2024-02-01T10:00:00.000Z',
        quantity: 15,
        grossAmount: 1800,
        fees: 15,
        taxes: 30,
      }),
    ];
    const { totals, positions } = computePortfolioFromOrders(accounts, orders, { bySymbol: { X: 50 } });
    expect(positions).toHaveLength(0);
    /** scale = 10/15 ; brut utilisé = 1800 * 2/3 = 1200 ; frais 10 ; taxes 20 → proceeds = 1170 ; coût sorti 1000 → réalisé 170 */
    expect(totals.totalRealizedPnL).toBe(170);
    expect(totals.totalFees).toBe(10);
    expect(totals.totalTaxes).toBe(20);
    expect(totals.totalRemainingCostBasis).toBe(0);
  });

  it('transfert sortant retire qté et coût au PRU sans PV', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 10,
        grossAmount: 1000,
        fees: 0,
      }),
      order({
        id: '2',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'TRANSFER_OUT',
        date: '2024-02-01T10:00:00.000Z',
        quantity: 4,
        grossAmount: 0,
      }),
    ];
    const { positions, totals } = computePortfolioFromOrders(accounts, orders, { bySymbol: { X: 100 } });
    expect(positions).toHaveLength(1);
    expect(positions[0].quantity).toBe(6);
    expect(positions[0].remainingCostBasis).toBe(600);
    expect(totals.totalRealizedPnL).toBe(0);
  });

  it('cours ancien : statut stale et alerte dédiée', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 1,
        grossAmount: 100,
        fees: 0,
      }),
    ];
    const nowMs = new Date('2026-06-15T12:00:00.000Z').getTime();
    const { positions } = computePortfolioFromOrders(
      accounts,
      orders,
      {
        bySymbol: { X: 120 },
        metaBySymbol: { X: { fetchedAt: '2026-06-01T08:00:00.000Z' } },
      },
      { nowMs, priceFreshMaxAgeMs: PORTFOLIO_PRICE_FRESH_MAX_MS }
    );
    expect(positions[0].priceStatus).toBe('stale');
    expect(positions[0].warnings.some((w) => w.code === 'STALE_PRICE_FOR_VALUATION')).toBe(true);
  });

  it('liquidation totale : coût restant et qté nuls', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 3,
        grossAmount: 300,
        fees: 0,
      }),
      order({
        id: '2',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'SELL',
        date: '2024-02-01T10:00:00.000Z',
        quantity: 3,
        grossAmount: 330,
        fees: 0,
        taxes: 0,
      }),
    ];
    const lots = foldOrdersToLots(orders);
    const lot = [...lots.values()].find((l) => l.assetSymbol === 'X');
    expect(lot?.qty).toBe(0);
    expect(lot?.costBasis).toBe(0);
  });

  it('identité : PV latente + réalisée + div = performance brute', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 10,
        grossAmount: 1000,
        fees: 0,
      }),
      order({
        id: '2',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'DIVIDEND',
        date: '2024-03-01T10:00:00.000Z',
        quantity: 0,
        grossAmount: 40,
        taxes: 10,
      }),
    ];
    const { totals } = computePortfolioFromOrders(accounts, orders, { bySymbol: { X: 110 } });
    const lhs = totals.totalUnrealizedPnL + totals.totalRealizedPnL + totals.totalDividendsNet;
    expect(Math.abs(lhs - totals.grossPerformanceEuro)).toBeLessThan(0.02);
  });

  it('même ETF sur deux enveloppes : lignes et totaux distincts', () => {
    const accounts = [acc('pea', 'PEA'), acc('cto', 'CTO')];
    const orders = [
      order({
        id: '1',
        accountId: 'pea',
        assetSymbol: 'CW8.PA',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 5,
        grossAmount: 500,
        fees: 0,
      }),
      order({
        id: '2',
        accountId: 'cto',
        assetSymbol: 'CW8.PA',
        type: 'BUY',
        date: '2024-01-02T10:00:00.000Z',
        quantity: 3,
        grossAmount: 300,
        fees: 0,
      }),
    ];
    const { positions, totals } = computePortfolioFromOrders(accounts, orders, { bySymbol: { 'CW8.PA': 100 } });
    expect(positions).toHaveLength(2);
    expect(totals.totalRemainingCostBasis).toBe(800);
    expect(totals.totalMarketValue).toBe(800);
    expect(totals.valuationCoverage.openLines).toBe(2);
  });

  it('cours manquant : valuationCoverage et valeur marché nulle', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'Z',
        type: 'BUY',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 2,
        grossAmount: 200,
        fees: 0,
      }),
    ];
    const { totals } = computePortfolioFromOrders(accounts, orders, { bySymbol: {} });
    expect(totals.valuationCoverage.linesMissingPrice).toBe(1);
    expect(totals.valuationCoverage.costBasisOpenWithoutPriceEuro).toBe(200);
    expect(totals.totalMarketValue).toBe(0);
  });

  it('survente historique : avertissement global', () => {
    const accounts = [acc('a1')];
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'SELL',
        date: '2024-01-01T10:00:00.000Z',
        quantity: 2,
        grossAmount: 200,
        fees: 0,
      }),
    ];
    const { globalWarnings } = computePortfolioFromOrders(accounts, orders, { bySymbol: { X: 10 } });
    expect(globalWarnings.length).toBeGreaterThan(0);
    expect(globalWarnings[0].message).toContain('Quantité excédentaire');
  });

  it('calcul net fiscal simplifié CTO', () => {
    const r = estimatePortfolioTaxSimple({
      incomeLikeByKind: {
        CTO: { unrealized: 100, realized: 200, dividends: 50 },
      },
      fiscal: { flatTaxRateOnIncome: 0.3 },
    });
    expect(r.lines[0].taxEstimateEuro).toBeCloseTo(75);
  });

  it('calcul surplus inflation', () => {
    const orders = [
      order({
        id: '1',
        accountId: 'a1',
        assetSymbol: 'X',
        type: 'BUY',
        date: '2020-01-01T10:00:00.000Z',
        quantity: 1,
        grossAmount: 1000,
        fees: 0,
      }),
    ];
    const s = surplusVsInflationEuro({
      currentMarketValueTotal: 1200,
      orders,
      annualInflationRate: 0.02,
      nowMs: new Date('2024-06-01T12:00:00.000Z').getTime(),
    });
    expect(s).toBeGreaterThan(0);
  });
});

describe('resolveGrossTransactionAmount', () => {
  it('priorité grossAmount', () => {
    expect(
      resolveGrossTransactionAmount({
        quantity: 2,
        unitPrice: 10,
        grossAmount: 50,
      })
    ).toBe(50);
  });
});
