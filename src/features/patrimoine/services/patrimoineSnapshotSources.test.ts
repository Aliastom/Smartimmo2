import { describe, expect, it } from 'vitest';
import { minimalPatrimoineSnapshot } from '@/features/patrimoine/test/patrimoineSnapshot.fixture';

/** Contrat d’interface snapshot (les valeurs effectives viennent de usePatrimoineSnapshot / IDB). */
describe('PatrimoineSnapshot sources', () => {
  it('expose MARKET quand le profil marché pilote cash / DCA', () => {
    const s = minimalPatrimoineSnapshot({
      sourceCash: 'MARKET',
      sourceDca: 'MARKET',
      sourceDcaDay: 'MARKET',
      selectedMarketInvestmentId: 'default',
      cashDisponible: 15_000,
      dcaRecommended: 400,
    });
    expect(s.sourceCash).toBe('MARKET');
    expect(s.sourceDca).toBe('MARKET');
    expect(s.cashDisponible).toBe(15_000);
  });

  it('expose PATRIMOINE sans profil marché résolu', () => {
    const s = minimalPatrimoineSnapshot({
      sourceCash: 'PATRIMOINE',
      sourceDca: 'PATRIMOINE',
      sourceDcaDay: 'PATRIMOINE',
      selectedMarketInvestmentId: null,
      availableMarketInvestments: [],
    });
    expect(s.sourceCash).toBe('PATRIMOINE');
    expect(s.sourceDca).toBe('PATRIMOINE');
  });
});
