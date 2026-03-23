'use client';

import { useMemo } from 'react';
import type { LeaseWithDetails } from '@/lib/services/leasesService';

export interface LeaseFinancialData {
  baseRent: number;
  chargesRecoverableMonthly: number;
  chargesNonRecoverableMonthly: number;
  deposit: number | null;
  paymentDay: number | null;
  totalDueByTenant: number;
  ownerContractualIncome: number;
}

export function useLeaseFinancialData(
  lease: LeaseWithDetails | null
): LeaseFinancialData | null {
  return useMemo(() => {
    if (!lease) return null;
    const baseRent = lease.rentAmount ?? 0;
    const chargesRecoverableMonthly = lease.chargesRecupMensuelles ?? 0;
    const chargesNonRecoverableMonthly = lease.chargesNonRecupMensuelles ?? 0;
    const deposit = lease.deposit ?? null;
    const paymentDay = lease.paymentDay ?? null;
    const totalDueByTenant = baseRent + chargesRecoverableMonthly;
    return {
      baseRent,
      chargesRecoverableMonthly,
      chargesNonRecoverableMonthly,
      deposit,
      paymentDay,
      totalDueByTenant,
      ownerContractualIncome: baseRent,
    };
  }, [lease]);
}
