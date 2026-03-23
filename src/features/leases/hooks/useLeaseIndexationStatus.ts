'use client';

import { useEffect, useMemo, useState } from 'react';
import { getLocalDB } from '@/lib/offline/db';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { getLeaseIndexationStatus, type LeaseIndexationStatusResult } from '../utils/leaseIndexationStatus';

const EMPTY: LeaseIndexationStatusResult = { status: 'NONE' };

export function useLeaseIndexationStatus(lease: LeaseWithDetails): LeaseIndexationStatusResult {
  const [historyDates, setHistoryDates] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const organizationId = lease.organizationId;
      if (!organizationId || !lease.id) {
        setHistoryDates([]);
        return;
      }
      try {
        const db = await getLocalDB();
        const rows = await db.RentIndexation.where('[organizationId+leaseId]').equals([organizationId, lease.id]).toArray();
        if (!cancelled) {
          setHistoryDates(rows.map((r: { effectiveDate: string }) => r.effectiveDate));
        }
      } catch {
        if (!cancelled) setHistoryDates([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [lease.id, lease.organizationId]);

  return useMemo(
    () =>
      getLeaseIndexationStatus(
        {
          status: lease.status,
          indexationType: lease.indexationType,
          startDate: lease.startDate,
        },
        historyDates.map((effectiveDate) => ({ effectiveDate }))
      ),
    [historyDates, lease.status, lease.indexationType, lease.startDate]
  );
}

