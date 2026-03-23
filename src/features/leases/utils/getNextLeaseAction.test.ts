import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getNextLeaseAction,
  getNextLeaseActionShortLabel,
  type LeaseForNextAction,
  type PaymentsTimelineInput,
} from './getNextLeaseAction';
import type { LeasePaymentsTimelineMonth } from '../hooks/useLeasePaymentsTimeline';

function month(y: number, m: number, overrides: Partial<LeasePaymentsTimelineMonth> = {}): LeasePaymentsTimelineMonth {
  const yearMonth = `${y}-${String(m).padStart(2, '0')}`;
  return {
    yearMonth,
    label: `${m}/${y}`,
    expected: 500,
    realized: 0,
    gap: -500,
    status: 'en_retard',
    transactionIds: [],
    echeanceIds: [],
    ...overrides,
  };
}

const baseLease: LeaseForNextAction = {
  id: 'l1',
  status: 'ACTIF',
  startDate: '2020-01-01',
  endDate: '2030-12-31',
  indexationType: 'insee',
};

function cockpit(
  statut: 'ok' | 'partiel' | 'retard',
  extra: Partial<PaymentsTimelineInput['cockpit']> = {}
): PaymentsTimelineInput['cockpit'] {
  return {
    loyerMensuel: 500,
    totalAttendu12Mois: 6000,
    totalEncaisse12Mois: 6000,
    tauxPaiement: 100,
    montantEnRetard: statut === 'retard' ? 500 : statut === 'partiel' ? 50 : 0,
    statutGlobal: statut,
    prochaineAction: '',
    ...extra,
  };
}

describe('getNextLeaseAction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('priorise PAY_REMAINING sur un mois partiel', () => {
    const months: LeasePaymentsTimelineMonth[] = [
      month(2026, 5, { status: 'partiel', expected: 558, realized: 540, gap: -18 }),
      month(2026, 6, { status: 'en_attente', expected: 558, realized: 0 }),
    ];
    const tl: PaymentsTimelineInput = { months, cockpit: cockpit('partiel'), loading: false };
    const a = getNextLeaseAction(baseLease, tl, {});
    expect(a.type).toBe('PAY_REMAINING');
    expect(a.amount).toBeCloseTo(18, 1);
    expect(a.month).toBe('2026-05');
    expect(a.label).toContain('Compléter paiement');
    expect(getNextLeaseActionShortLabel(a)).toMatch(/Payer/);
  });

  it('PAY_FULL quand retard sans encaissement', () => {
    const months: LeasePaymentsTimelineMonth[] = [
      month(2026, 4, { status: 'en_retard', expected: 558, realized: 0 }),
      month(2026, 5, { status: 'payé', expected: 558, realized: 558 }),
    ];
    const tl: PaymentsTimelineInput = { months, cockpit: cockpit('retard'), loading: false };
    const a = getNextLeaseAction(baseLease, tl, {});
    expect(a.type).toBe('PAY_FULL');
    expect(a.amount).toBe(558);
    expect(a.month).toBe('2026-04');
    expect(getNextLeaseActionShortLabel(a)).toContain('Encaisser');
  });

  it('GENERATE_RECEIPT si paiements OK et pendingReceipt fourni', () => {
    const months: LeasePaymentsTimelineMonth[] = [
      month(2026, 5, { status: 'payé', expected: 558, realized: 558 }),
      month(2026, 6, { status: 'payé', expected: 558, realized: 558 }),
    ];
    const tl: PaymentsTimelineInput = { months, cockpit: cockpit('ok'), loading: false };
    const a = getNextLeaseAction(baseLease, tl, {
      pendingReceipt: { yearMonth: '2026-05', label: 'mai 2026' },
    });
    expect(a.type).toBe('GENERATE_RECEIPT');
    expect(getNextLeaseActionShortLabel(a)).toBe('Générer quittance');
  });

  it('INDEXATION avant RENEWAL si les deux fenêtres', () => {
    vi.setSystemTime(new Date('2025-12-20T12:00:00Z'));
    const lease: LeaseForNextAction = {
      ...baseLease,
      startDate: '2025-01-10',
      endDate: '2026-02-15',
      indexationType: 'insee',
    };
    const months: LeasePaymentsTimelineMonth[] = [
      month(2025, 12, { status: 'payé', expected: 400, realized: 400 }),
    ];
    const tl: PaymentsTimelineInput = { months, cockpit: cockpit('ok'), loading: false };
    const a = getNextLeaseAction(lease, tl, { indexationStatus: 'DUE' });
    expect(a.type).toBe('INDEXATION');
  });

  it("n'affiche pas INDEXATION si déjà appliquée", () => {
    vi.setSystemTime(new Date('2025-12-20T12:00:00Z'));
    const lease: LeaseForNextAction = {
      ...baseLease,
      startDate: '2025-01-10',
      endDate: '2026-02-15',
      indexationType: 'insee',
    };
    const months: LeasePaymentsTimelineMonth[] = [month(2025, 12, { status: 'payé', expected: 400, realized: 400 })];
    const tl: PaymentsTimelineInput = { months, cockpit: cockpit('ok'), loading: false };
    const a = getNextLeaseAction(lease, tl, { indexationStatus: 'APPLIED' });
    expect(a.type).toBe('RENEWAL');
  });

  it('RENEWAL quand fin dans moins de 90 jours (sans indexation prioritaire)', () => {
    vi.setSystemTime(new Date('2026-01-10T12:00:00Z'));
    const lease: LeaseForNextAction = {
      ...baseLease,
      startDate: '2020-01-01',
      endDate: '2026-03-01',
      indexationType: 'none',
    };
    const months: LeasePaymentsTimelineMonth[] = [
      month(2026, 1, { status: 'payé', expected: 400, realized: 400 }),
    ];
    const tl: PaymentsTimelineInput = { months, cockpit: cockpit('ok'), loading: false };
    const a = getNextLeaseAction(lease, tl, {});
    expect(a.type).toBe('RENEWAL');
    expect(getNextLeaseActionShortLabel(a)).toBe('Renouveler');
  });

  it('NONE avec libellé à jour si tout est OK', () => {
    const months: LeasePaymentsTimelineMonth[] = [
      month(2026, 5, { status: 'payé', expected: 400, realized: 400 }),
    ];
    const tl: PaymentsTimelineInput = { months, cockpit: cockpit('ok'), loading: false };
    const lease: LeaseForNextAction = {
      ...baseLease,
      endDate: '2035-01-01',
      indexationType: 'none',
    };
    const a = getNextLeaseAction(lease, tl, {});
    expect(a.type).toBe('NONE');
    expect(a.label).toBe('Aucune action requise');
  });

  it('bail résilié → NONE', () => {
    const tl: PaymentsTimelineInput = { months: [], cockpit: cockpit('ok'), loading: false };
    const a = getNextLeaseAction({ ...baseLease, status: 'RÉSILIÉ' }, tl, {});
    expect(a.type).toBe('NONE');
    expect(a.label).toBe('Aucune action requise');
  });

  it('bail brouillon -> action envoyer pour signature', () => {
    const tl: PaymentsTimelineInput = { months: [], cockpit: cockpit('ok'), loading: false };
    const a = getNextLeaseAction({ ...baseLease, status: 'BROUILLON' }, tl, {});
    expect(a.type).toBe('NONE');
    expect(a.label).toBe('Envoyer pour signature');
    expect(getNextLeaseActionShortLabel(a)).toBe('Envoyer pour signature');
  });

  it('bail à signer -> action envoyer pour signature', () => {
    const tl: PaymentsTimelineInput = { months: [], cockpit: cockpit('ok'), loading: false };
    const a = getNextLeaseAction({ ...baseLease, status: 'ENVOYÉ' }, tl, {});
    expect(a.type).toBe('NONE');
    expect(a.label).toBe('Attendre la signature');
    expect(getNextLeaseActionShortLabel(a)).toBe('Attendre la signature');
  });
});
