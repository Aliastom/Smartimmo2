/**
 * Tests métier pour getLateRentAlerts.
 * Garantit la cohérence résumé / détail et les deux modes (impayés ouverts vs échéances du mois).
 */

import { getLateRentAlerts, getLateRentsSectionLabel, getDueInMonthFilterLabel } from '../lateRentAlerts';

const propertyNameById = new Map([['p1', 'Bien A']]);
const tenantNameById = new Map([['t1', 'Jean Dupont']]);
const acquisitionDateByPropertyId = new Map<string, string | null>();

function lease(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lease1',
    propertyId: 'p1',
    tenantId: 't1',
    rentAmount: 800,
    startDate: '2024-01-01',
    endDate: null,
    ...overrides,
  };
}

describe('getLateRentAlerts', () => {
  describe('Cas 1 : 7 impayés de mois antérieurs (janv–juil 2024), juillet 2025 payé', () => {
    it('open_arrears_as_of_month retourne 7 (impayés ouverts à fin juillet 2025)', () => {
      const paidMonths = new Set<string>();
      for (let m = 8; m <= 12; m++) paidMonths.add(`l1-2024-${String(m).padStart(2, '0')}`);
      for (let m = 1; m <= 7; m++) paidMonths.add(`l1-2025-${String(m).padStart(2, '0')}`);
      const leasesList = [
        lease({ id: 'l1', startDate: '2024-01-01' }),
      ];
      const open = getLateRentAlerts({
        leases: leasesList,
        paidMonths,
        selectedMonth: '2025-07',
        mode: 'open_arrears_as_of_month',
        propertyNameById,
        tenantNameById,
        acquisitionDateByPropertyId,
      });
      expect(open.length).toBe(7);
      const months = open.map(r => r.accountingMonth).sort();
      expect(months).toEqual(['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06', '2024-07']);
    });

    it('due_in_selected_month retourne 0 (échéance juillet 2025 payée)', () => {
      const paidMonths = new Set<string>();
      paidMonths.add('l1-2025-07');
      const leasesList = [
        lease({ id: 'l1', startDate: '2024-01-01' }),
      ];
      const due = getLateRentAlerts({
        leases: leasesList,
        paidMonths,
        selectedMonth: '2025-07',
        mode: 'due_in_selected_month',
        propertyNameById,
        tenantNameById,
        acquisitionDateByPropertyId,
      });
      expect(due.length).toBe(0);
    });
  });

  describe('Cas 2 : 2 loyers de juillet non payés', () => {
    it('open_arrears et due_in_selected_month cohérents', () => {
      const paidMonths = new Set<string>();
      const leasesList = [
        lease({ id: 'l1', startDate: '2025-01-01' }),
        lease({ id: 'l2', startDate: '2025-01-01', propertyId: 'p1', tenantId: 't1' }),
      ];
      const open = getLateRentAlerts({
        leases: leasesList,
        paidMonths,
        selectedMonth: '2025-07',
        mode: 'open_arrears_as_of_month',
        propertyNameById,
        tenantNameById,
        acquisitionDateByPropertyId,
      });
      const due = getLateRentAlerts({
        leases: leasesList,
        paidMonths,
        selectedMonth: '2025-07',
        mode: 'due_in_selected_month',
        propertyNameById,
        tenantNameById,
        acquisitionDateByPropertyId,
      });
      expect(open.length).toBeGreaterThanOrEqual(2);
      expect(due.length).toBe(2);
      expect(due.every(r => r.accountingMonth === '2025-07')).toBe(true);
    });
  });

  describe('Cas 3 : mois payé = pas en retard', () => {
    it('un loyer de juillet payé (dans paidMonths) n’apparaît pas', () => {
      const paidMonths = new Set<string>(['l1-2025-07']);
      const leasesList = [
        lease({ id: 'l1', startDate: '2025-01-01' }),
      ];
      const open = getLateRentAlerts({
        leases: leasesList,
        paidMonths,
        selectedMonth: '2025-07',
        mode: 'open_arrears_as_of_month',
        propertyNameById,
        tenantNameById,
        acquisitionDateByPropertyId,
      });
      const due = getLateRentAlerts({
        leases: leasesList,
        paidMonths,
        selectedMonth: '2025-07',
        mode: 'due_in_selected_month',
        propertyNameById,
        tenantNameById,
        acquisitionDateByPropertyId,
      });
      expect(open.some(r => r.accountingMonth === '2025-07')).toBe(false);
      expect(due.length).toBe(0);
    });
  });
});

describe('getLateRentsSectionLabel', () => {
  it('formate le libellé avec mois et count', () => {
    expect(getLateRentsSectionLabel('2025-07', 7)).toContain('Juillet 2025');
    expect(getLateRentsSectionLabel('2025-07', 7)).toContain('7');
  });
});

describe('getDueInMonthFilterLabel', () => {
  it('formate le mois pour le filtre', () => {
    expect(getDueInMonthFilterLabel('2025-07')).toMatch(/juillet|Juillet/);
    expect(getDueInMonthFilterLabel('2025-07')).toContain('2025');
  });
});
