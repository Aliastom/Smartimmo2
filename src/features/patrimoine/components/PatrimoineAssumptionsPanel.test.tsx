import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PatrimoineAssumptionsPanel } from '@/features/patrimoine/components/PatrimoineAssumptionsPanel';
import { getPatrimoineSettingsDefaults } from '@/features/patrimoine/store/patrimoineSettings';
import { minimalPatrimoineSnapshot } from '@/features/patrimoine/test/patrimoineSnapshot.fixture';

describe('PatrimoineAssumptionsPanel (brouillon / validation)', () => {
  const defaults = getPatrimoineSettingsDefaults();

  beforeEach(() => {
    vi.spyOn(window, 'dispatchEvent').mockImplementation(() => true);
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

  it('Valider enregistre et déclenche patrimoine:refresh', () => {
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
    expect(onCommit).toHaveBeenCalledTimes(1);
    const payload = onCommit.mock.calls[0][0];
    expect(payload.cashSecurite).toBe(4000);
    expect(window.dispatchEvent).toHaveBeenCalled();
    const evt = (window.dispatchEvent as unknown as vi.Mock).mock.calls.find(
      (c) => c[0] instanceof CustomEvent && (c[0] as CustomEvent).type === 'patrimoine:refresh'
    );
    expect(evt).toBeTruthy();
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

  it('Réinitialiser appelle onCommit avec les défauts', () => {
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
    expect(onCommit).toHaveBeenCalled();
    const payload = onCommit.mock.calls[0][0];
    expect(payload.cashSecurite).toBe(defaults.cashSecurite);
    expect(payload.peaEtfValue).toBe(defaults.peaEtfValue);
  });

  it('affiche l’aide profil Marché pour le cash quand sourceCash = MARKET', () => {
    const onCommit = vi.fn();
    const snap = minimalPatrimoineSnapshot({
      sourceCash: 'MARKET',
      sourceDca: 'MARKET',
      sourceDcaDay: 'MARKET',
      cashDisponible: 20_000,
      dcaRecommended: 400,
      effectiveDcaDayOfMonth: 7,
    });
    render(
      <PatrimoineAssumptionsPanel organizationId="org-1" savedSettings={defaults} snapshot={snap} onCommit={onCommit} />
    );
    expect(screen.getAllByTestId('market-pilot-hint').length).toBeGreaterThanOrEqual(3);
  });
});
