import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getLeaseIndexationStatus } from './leaseIndexationStatus';

describe('getLeaseIndexationStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('NONE si bail non actif', () => {
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z'));
    const result = getLeaseIndexationStatus({
      status: 'BROUILLON',
      indexationType: 'IRL',
      startDate: '2022-04-20',
    });
    expect(result.status).toBe('NONE');
  });

  it('UPCOMING dans fenêtre J-30 avant anniversaire', () => {
    vi.setSystemTime(new Date('2026-03-30T12:00:00Z'));
    const result = getLeaseIndexationStatus({
      status: 'ACTIF',
      indexationType: 'IRL',
      startDate: '2020-04-20',
    });
    expect(result.status).toBe('UPCOMING');
  });

  it('DUE après anniversaire dans la fenêtre', () => {
    vi.setSystemTime(new Date('2026-04-25T12:00:00Z'));
    const result = getLeaseIndexationStatus({
      status: 'ACTIF',
      indexationType: 'IRL',
      startDate: '2020-04-20',
    });
    expect(result.status).toBe('DUE');
  });

  it('APPLIED si déjà indexé dans la période', () => {
    vi.setSystemTime(new Date('2026-04-25T12:00:00Z'));
    const result = getLeaseIndexationStatus(
      {
        status: 'ACTIF',
        indexationType: 'IRL',
        startDate: '2020-04-20',
      },
      [{ effectiveDate: '2026-04-22' }]
    );
    expect(result.status).toBe('APPLIED');
  });
});

