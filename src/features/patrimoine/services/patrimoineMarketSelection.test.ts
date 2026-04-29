import { describe, expect, it } from 'vitest';
import type { InvestmentSettings } from '@/features/market/types';
import { DEFAULT_MARKET_INVESTMENT_SETTINGS_ID } from '@/features/market/services/marketInvestmentStorage';
import {
  pickAutoMarketInvestment,
  resolvePatrimoineMarketInvestment,
} from '@/features/patrimoine/services/patrimoineMarketSelection';

function inv(partial: Partial<InvestmentSettings> & Pick<InvestmentSettings, 'id'>): InvestmentSettings {
  return {
    organizationId: 'org',
    referenceSymbol: 'CW8.PA',
    referenceLabel: '',
    envelope: 'PEA',
    athPeriod: 'MAX',
    availableCash: 0,
    monthlyDcaAmount: 100,
    monthlyInvestmentDay: 5,
    reinforce10Threshold: -10,
    reinforce20Threshold: -20,
    reinforce10Amount: 0,
    reinforce20Amount: 0,
    strategy: 'DCA_PLUS_REINFORCE',
    cashReferenceAmount: 0,
    currency: 'EUR',
    updatedAt: '2026-01-01T00:00:00.000Z',
    peaSocialContributionsOnGainsRate: 0,
    investmentStrategy: { monthlyDca: 100, reinforceLevels: [] },
    ...partial,
  } as InvestmentSettings;
}

describe('resolvePatrimoineMarketInvestment', () => {
  it('AUTO prend le profil default si présent', () => {
    const other = inv({
      id: 'alt',
      updatedAt: '2026-06-01T00:00:00.000Z',
      monthlyDcaAmount: 999,
    });
    const def = inv({
      id: DEFAULT_MARKET_INVESTMENT_SETTINGS_ID,
      updatedAt: '2026-01-01T00:00:00.000Z',
      monthlyDcaAmount: 400,
    });
    const r = resolvePatrimoineMarketInvestment([other, def], null);
    expect(r.mode).toBe('AUTO');
    expect(r.selectedInvestment?.id).toBe(DEFAULT_MARKET_INVESTMENT_SETTINGS_ID);
    expect(r.selectedInvestment?.monthlyDcaAmount).toBe(400);
    expect(r.warning).toBeNull();
  });

  it('AUTO sans default prend le profil le plus récent (premier de la liste triée)', () => {
    const older = inv({ id: 'a', updatedAt: '2026-01-01T00:00:00.000Z' });
    const newer = inv({ id: 'b', updatedAt: '2026-03-01T00:00:00.000Z' });
    const r = resolvePatrimoineMarketInvestment([newer, older], null);
    expect(r.mode).toBe('AUTO');
    expect(r.selectedInvestment?.id).toBe('b');
  });

  it('MANUEL sélectionne le profil demandé', () => {
    const a = inv({ id: 'p1', monthlyDcaAmount: 100 });
    const b = inv({ id: 'p2', monthlyDcaAmount: 250 });
    const r = resolvePatrimoineMarketInvestment([a, b], 'p2');
    expect(r.mode).toBe('MANUAL');
    expect(r.selectedInvestment?.monthlyDcaAmount).toBe(250);
  });

  it('id supprimé → MISSING_FALLBACK + warning', () => {
    const a = inv({ id: DEFAULT_MARKET_INVESTMENT_SETTINGS_ID, monthlyDcaAmount: 50 });
    const r = resolvePatrimoineMarketInvestment([a], 'ghost-id');
    expect(r.mode).toBe('MISSING_FALLBACK');
    expect(r.selectedInvestment?.id).toBe(DEFAULT_MARKET_INVESTMENT_SETTINGS_ID);
    expect(r.warning).toMatch(/introuvable/i);
  });

  it('aucun profil → selectedInvestment null', () => {
    const r = resolvePatrimoineMarketInvestment([], null);
    expect(r.mode).toBe('AUTO');
    expect(r.selectedInvestment).toBeNull();
  });

  it('pickAutoMarketInvestment liste vide → null', () => {
    expect(pickAutoMarketInvestment([])).toBeNull();
  });
});
