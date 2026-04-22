import { describe, it, expect } from 'vitest';
import { LoanInterestYearAggregator, scheduleRowCalendarYear } from '@/services/tax/LoanInterestYearAggregator';
import { buildSchedule } from '@/lib/finance/amortization';

describe('LoanInterestYearAggregator', () => {
  const baseLoan = {
    id: 'loan-a',
    propertyId: 'prop-1',
    label: 'Prêt test',
    principal: 120_000,
    annualRatePct: 3,
    durationMonths: 120,
    defermentMonths: 0,
    insurancePct: 0,
    startDate: new Date('2025-01-10'),
    endDate: null as Date | null,
    paymentDay: 10,
    repaymentType: 'CLASSIC',
    amortizationProfile: 'CONSTANT_PAYMENT',
    rateType: 'FIXED',
  };

  it('somme les intérêts des échéances de l’année civile (hors capital)', () => {
    const r = LoanInterestYearAggregator.aggregate({
      loans: [baseLoan],
      year: 2025,
      expectedPropertyId: 'prop-1',
    });
    expect(r.byLoan).toHaveLength(1);
    expect(r.totalInteretsEmprunt).toBeGreaterThan(0);

    const schedule = buildSchedule({
      principal: 120_000,
      annualRatePct: 3,
      durationMonths: 120,
      defermentMonths: 0,
      insurancePct: 0,
      startDate: new Date('2025-01-10'),
      paymentDay: 10,
    });
    let interetsAnnee = 0;
    let capitalAnnee = 0;
    for (const row of schedule) {
      if (scheduleRowCalendarYear(row) !== 2025) continue;
      interetsAnnee += row.paymentInterest;
      capitalAnnee += row.paymentPrincipal;
    }
    expect(r.totalInteretsEmprunt).toBeCloseTo(Math.round(interetsAnnee * 100) / 100, 1);
    expect(capitalAnnee).toBeGreaterThan(0);
    expect(r.totalInteretsEmprunt + capitalAnnee).not.toBeCloseTo(capitalAnnee, 0);
  });

  it('agrège plusieurs prêts sur le même bien sans double comptage entre biens', () => {
    const r = LoanInterestYearAggregator.aggregate({
      loans: [
        { ...baseLoan, id: 'l1', label: 'A' },
        {
          ...baseLoan,
          id: 'l2',
          label: 'B',
          principal: 60_000,
          startDate: new Date('2025-02-05'),
        },
      ],
      year: 2025,
      expectedPropertyId: 'prop-1',
    });
    expect(r.byLoan).toHaveLength(2);
    expect(r.totalInteretsEmprunt).toBeCloseTo(
      r.byLoan.reduce((s, x) => s + x.interetsPayesAnnee, 0),
      2
    );
  });

  it('ne produit pas de montant si le capital est non fiable', () => {
    const r = LoanInterestYearAggregator.aggregate({
      loans: [{ ...baseLoan, id: 'bad', principal: 0 }],
      year: 2025,
      expectedPropertyId: 'prop-1',
    });
    expect(r.totalInteretsEmprunt).toBe(0);
    expect(r.byLoan).toHaveLength(0);
    expect(r.ambiguities.length).toBeGreaterThanOrEqual(1);
  });

  it('in fine : ambiguïté et pas d’intérêt agrégé pour ce prêt', () => {
    const r = LoanInterestYearAggregator.aggregate({
      loans: [{ ...baseLoan, id: 'inf', repaymentType: 'IN_FINE' }],
      year: 2025,
      expectedPropertyId: 'prop-1',
    });
    expect(r.totalInteretsEmprunt).toBe(0);
    expect(r.byLoan).toHaveLength(0);
    expect(r.ambiguities.some((a) => a.loanId === 'inf')).toBe(true);
  });

  it('prêt rattaché à un autre bien : ambiguïté et exclusion', () => {
    const r = LoanInterestYearAggregator.aggregate({
      loans: [{ ...baseLoan, id: 'x', propertyId: 'autre-bien' }],
      year: 2025,
      expectedPropertyId: 'prop-1',
    });
    expect(r.totalInteretsEmprunt).toBe(0);
    expect(r.byLoan).toHaveLength(0);
    expect(r.ambiguities[0]?.loanId).toBe('x');
  });
});
