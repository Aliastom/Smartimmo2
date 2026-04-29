import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PatrimoineAssumptionsPanel } from '@/features/patrimoine/components/PatrimoineAssumptionsPanel';
import { PatrimoineDecisionCockpit } from '@/features/patrimoine/components/PatrimoineDecisionCockpit';
import { PatrimoineGlobalBadges } from '@/features/patrimoine/components/PatrimoineGlobalBadges';
import { getPatrimoineSettingsDefaults } from '@/features/patrimoine/store/patrimoineSettings';
import { minimalPatrimoineSnapshot } from '@/features/patrimoine/test/patrimoineSnapshot.fixture';

describe('Patrimoine UI smoke', () => {
  it('PatrimoineDecisionCockpit rend sans crash avec snapshot incomplet', () => {
    const snap = minimalPatrimoineSnapshot({
      patrimoineReco: {
        primaryAction: 'WAIT',
        dcaAmount: 0,
        reinforceAmount: 0,
        message: '',
        level: 'INFO',
      },
      nextEvents: {
        nextTaxPayment: 'invalid-iso',
        nextDcaDate: null,
        nextLoanPayment: 'not-a-date',
      },
      projectionPatrimoineDeltaRatio: Number.NaN,
    });
    const { container } = render(
      <PatrimoineDecisionCockpit organizationId="org-test" snapshot={snap} />
    );
    expect(container.textContent).toMatch(/échéances/i);
    expect(screen.getByText(/pourquoi cette recommandation/i)).toBeInTheDocument();
  });

  it('PatrimoineAssumptionsPanel : reset appelle onSettingsChange avec les défauts', () => {
    const onSettingsChange = vi.fn();
    const defaults = getPatrimoineSettingsDefaults();
    const snap = minimalPatrimoineSnapshot();
    render(
      <PatrimoineAssumptionsPanel
        organizationId="org-x"
        settings={{
          cashDisponible: 99_999,
          cashSecurite: 1,
          peaEtfValue: 12_000,
          dcaDayOfMonth: 12,
          objective: 'croissance',
        }}
        onSettingsChange={onSettingsChange}
        snapshot={snap}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /réinitialiser/i }));
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        cashDisponible: defaults.cashDisponible,
        cashSecurite: defaults.cashSecurite,
        peaEtfValue: defaults.peaEtfValue,
        dcaDayOfMonth: defaults.dcaDayOfMonth,
        objective: defaults.objective,
        selectedFiscalSimulationId: defaults.selectedFiscalSimulationId ?? null,
        selectedMarketInvestmentId: defaults.selectedMarketInvestmentId ?? null,
      })
    );
  });

  it('PatrimoineGlobalBadges affiche les états fiscal / marché', () => {
    const snapOff = minimalPatrimoineSnapshot({
      hasFiscalSimulation: false,
      hasMarketData: false,
      availableMarketInvestments: [],
    });
    const { rerender, container } = render(<PatrimoineGlobalBadges snapshot={snapOff} />);
    expect(container.textContent).toMatch(/non reliée/i);
    expect(container.textContent).toMatch(/marché\s*:\s*non disponible/i);

    const snapOn = minimalPatrimoineSnapshot({
      hasFiscalSimulation: true,
      fiscalYear: 2025,
      hasMarketData: true,
      availableMarketInvestments: [{ id: 'default', label: 'CW8.PA · test' }],
      marketInvestmentSelectionMode: 'AUTO',
    });
    rerender(<PatrimoineGlobalBadges snapshot={snapOn} />);
    expect(container.textContent).toMatch(/auto|manuelle/i);
    expect(container.textContent).toMatch(/marché\s*:\s*auto/i);
  });
});
