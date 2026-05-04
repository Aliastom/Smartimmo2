import { describe, it, expect } from 'vitest';
import {
  resolveLmnpLoanKpisForPilotage,
  sumTransactionAssuranceAmounts,
  sumTransactionInterestAmounts,
} from '@/lib/lmnp/lmnpPilotageKpis';

describe('resolveLmnpLoanKpisForPilotage', () => {
  const rows = [
    { lmnp_bucket: 'CHARGES_FINANCIERES', amount: -320 },
    { lmnp_bucket: 'CHARGES_ASSURANCE', amount: -150 },
  ];

  it('privilégie l’échéancier quand les montants > 0 (évite double comptage avec les écritures)', () => {
    const r = resolveLmnpLoanKpisForPilotage({
      loanInterestsFromSchedule: 940.5,
      loanInsuranceFromSchedule: 531.96,
      ecritureRows: rows,
    });
    expect(r.interets).toBe(940.5);
    expect(r.assurance).toBe(531.96);
    expect(r.usedScheduleForInterets).toBe(true);
    expect(r.usedScheduleForAssurance).toBe(true);
  });

  it('retombe sur les transactions si l’échéancier est à 0', () => {
    const r = resolveLmnpLoanKpisForPilotage({
      loanInterestsFromSchedule: 0,
      loanInsuranceFromSchedule: 0,
      ecritureRows: rows,
    });
    expect(r.interets).toBe(320);
    expect(r.assurance).toBe(150);
    expect(r.usedScheduleForInterets).toBe(false);
    expect(r.usedScheduleForAssurance).toBe(false);
  });

  it('assurance échéancier seul : intérêts encore fallback transactions si besoin', () => {
    const r = resolveLmnpLoanKpisForPilotage({
      loanInterestsFromSchedule: 0,
      loanInsuranceFromSchedule: 531.96,
      ecritureRows: rows,
    });
    expect(r.interets).toBe(320);
    expect(r.assurance).toBe(531.96);
  });
});

describe('sumTransactionInterestAmounts', () => {
  it('détecte FINANCIER et INTERET dans le bucket', () => {
    const s = sumTransactionInterestAmounts([
      { lmnp_bucket: 'CHARGES_FINANCIERES', amount: -10 },
      { lmnp_bucket: 'CHARGES_EXPLOITATION', amount: -5 },
    ]);
    expect(s).toBe(-10);
  });
});

describe('sumTransactionAssuranceAmounts', () => {
  it('somme les buckets contenant ASSURANCE', () => {
    const s = sumTransactionAssuranceAmounts([
      { lmnp_bucket: 'CHARGES_ASSURANCE', amount: -44 },
      { lmnp_bucket: 'RECETTES_LOYER', amount: 100 },
    ]);
    expect(s).toBe(-44);
  });
});
