import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PatrimoineAssumptionsPanel } from '@/features/patrimoine/components/PatrimoineAssumptionsPanel';
import { getPatrimoineSettingsDefaults } from '@/features/patrimoine/store/patrimoineSettings';
import { minimalPatrimoineSnapshot } from '@/features/patrimoine/test/patrimoineSnapshot.fixture';
import { marketInvestmentStorage } from '@/features/market/services/marketInvestmentStorage';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PatrimoineAssumptionsPanel (brouillon / validation)', () => {
  const defaults = getPatrimoineSettingsDefaults();

  beforeEach(() => {
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
    vi.spyOn(marketInvestmentStorage, 'updateInvestmentProfileFromPatrimoine').mockResolvedValue('ok');
    vi.spyOn(marketInvestmentStorage, 'getInvestmentProfileById').mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ne appelle pas onCommit à la frappe', () => {
    const onCommit = vi.fn();
    const snap = minimalPatrimoineSnapshot({ sourceCash: 'PATRIMOINE', sourceDca: 'PATRIMOINE', sourceDcaDay: 'PATRIMOINE' });
    render(
      <PatrimoineAssumptionsPanel
        organizationId="org-1"
        savedSettings={{ ...defaults, cashSecurite: 3000 }}
        snapshot={snap}
        onCommit={onCommit}
      />
    );
    fireEvent.change(screen.getByTestId('input-cash-disponible'), { target: { value: '8888' } });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Valider enregistre et déclenche patrimoine:refresh', async () => {
    const onCommit = vi.fn();
    const snap = minimalPatrimoineSnapshot({ sourceCash: 'PATRIMOINE', sourceDca: 'PATRIMOINE', sourceDcaDay: 'PATRIMOINE' });
    render(
      <PatrimoineAssumptionsPanel
        organizationId="org-1"
        savedSettings={{ ...defaults, cashSecurite: 3000 }}
        snapshot={snap}
        onCommit={onCommit}
      />
    );
    const cashSec = screen.getByDisplayValue('3000');
    fireEvent.change(cashSec, { target: { value: '4000' } });
    fireEvent.click(screen.getByTestId('btn-validate-assumptions'));
    await waitFor(() => expect(onCommit).toHaveBeenCalledTimes(1));
    const payload = onCommit.mock.calls[0][0];
    expect(payload.cashSecurite).toBe(4000);
    expect(window.dispatchEvent).toHaveBeenCalled();
    const evt = (window.dispatchEvent as unknown as vi.Mock).mock.calls.find(
      (c) => c[0] instanceof CustomEvent && (c[0] as CustomEvent).type === 'patrimoine:refresh'
    );
    expect(evt).toBeTruthy();
    expect(marketInvestmentStorage.updateInvestmentProfileFromPatrimoine).not.toHaveBeenCalled();
  });

  it('Annuler restaure les valeurs sauvegardées', () => {
    const onCommit = vi.fn();
    const snap = minimalPatrimoineSnapshot({ sourceCash: 'PATRIMOINE', sourceDca: 'PATRIMOINE', sourceDcaDay: 'PATRIMOINE' });
    render(
      <PatrimoineAssumptionsPanel
        organizationId="org-1"
        savedSettings={{ ...defaults, cashSecurite: 3000 }}
        snapshot={snap}
        onCommit={onCommit}
      />
    );
    const cashSec = screen.getByDisplayValue('3000');
    fireEvent.change(cashSec, { target: { value: '9999' } });
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('3000')).toBeInTheDocument();
  });

  it('Réinitialiser appelle onCommit avec les défauts', async () => {
    const onCommit = vi.fn();
    const snap = minimalPatrimoineSnapshot({ sourceCash: 'PATRIMOINE', sourceDca: 'PATRIMOINE', sourceDcaDay: 'PATRIMOINE' });
    render(
      <PatrimoineAssumptionsPanel
        organizationId="org-1"
        savedSettings={{ ...defaults, cashSecurite: 12_000, peaEtfValue: 50_000 }}
        snapshot={snap}
        onCommit={onCommit}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /réinitialiser/i }));
    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const payload = onCommit.mock.calls[0][0];
    expect(payload.cashSecurite).toBe(defaults.cashSecurite);
    expect(payload.peaEtfValue).toBe(defaults.peaEtfValue);
  });

  it('profil Marché résolu : validation met à jour le profil et ne duplique pas cash local', async () => {
    const onCommit = vi.fn();
    const snap = minimalPatrimoineSnapshot({
      sourceCash: 'MARKET',
      sourceDca: 'MARKET',
      sourceDcaDay: 'MARKET',
      selectedMarketInvestmentId: 'profil-1',
      cashDisponible: 20_000,
      dcaRecommended: 400,
      effectiveDcaDayOfMonth: 7,
      resolvedMarketAvailableCash: 20_000,
      resolvedMarketMonthlyDca: 400,
      resolvedMarketInvestmentDay: 7,
      cockpitMarketSymbol: 'CW8.PA',
      cockpitMarketCurrentPrice: 100,
      cockpitMarketAthPeriod: 'MAX',
    });
    render(
      <PatrimoineAssumptionsPanel
        organizationId="org-1"
        savedSettings={{ ...defaults, cashDisponible: 999, selectedMarketInvestmentId: 'profil-1' }}
        snapshot={snap}
        onCommit={onCommit}
      />
    );
    fireEvent.change(screen.getByTestId('input-cash-disponible-market'), { target: { value: '25000' } });
    fireEvent.click(screen.getByTestId('btn-validate-assumptions'));
    await waitFor(() => expect(marketInvestmentStorage.updateInvestmentProfileFromPatrimoine).toHaveBeenCalledWith(
      'org-1',
      'profil-1',
      expect.objectContaining({ availableCash: 25000 })
    ));
    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    const payload = onCommit.mock.calls[0][0];
    expect(payload.cashDisponible).toBe(999);
    expect(payload.patrimoineReferenceMonthlyDca).toBeUndefined();
  });

  it('sans profil marché : fallback patrimoine pour DCA / cash', async () => {
    const onCommit = vi.fn();
    const snap = minimalPatrimoineSnapshot({
      sourceCash: 'PATRIMOINE',
      sourceDca: 'PATRIMOINE',
      sourceDcaDay: 'PATRIMOINE',
      selectedMarketInvestmentId: null,
    });
    render(
      <PatrimoineAssumptionsPanel
        organizationId="org-1"
        savedSettings={{ ...defaults, cashDisponible: 1000 }}
        snapshot={snap}
        onCommit={onCommit}
      />
    );
    fireEvent.change(screen.getByTestId('input-dca-monthly-patrimoine'), { target: { value: '750' } });
    fireEvent.click(screen.getByTestId('btn-validate-assumptions'));
    await waitFor(() => expect(onCommit).toHaveBeenCalled());
    expect(marketInvestmentStorage.updateInvestmentProfileFromPatrimoine).not.toHaveBeenCalled();
    expect(onCommit.mock.calls[0][0].patrimoineReferenceMonthlyDca).toBe(750);
  });

  it('affiche synchro Marché pour le cash quand profil résolu', () => {
    const onCommit = vi.fn();
    const snap = minimalPatrimoineSnapshot({
      sourceCash: 'MARKET',
      sourceDca: 'MARKET',
      sourceDcaDay: 'MARKET',
      selectedMarketInvestmentId: 'p1',
      cashDisponible: 20_000,
      resolvedMarketMonthlyDca: 400,
      resolvedMarketInvestmentDay: 7,
      resolvedMarketAvailableCash: 20_000,
      dcaRecommended: 400,
      effectiveDcaDayOfMonth: 7,
    });
    render(
      <PatrimoineAssumptionsPanel organizationId="org-1" savedSettings={defaults} snapshot={snap} onCommit={onCommit} />
    );
    expect(screen.getAllByTestId('market-sync-hint').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('input-cash-disponible-market')).toBeInTheDocument();
  });
});
