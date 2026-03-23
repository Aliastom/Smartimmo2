'use client';

import React from 'react';
import { useLeasePaymentsTimeline } from '../hooks/useLeasePaymentsTimeline';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { getLeasePaymentHealthInfo } from '../utils/leaseWorkflowStatus';

interface LeaseHealthBadgeProps {
  lease: LeaseWithDetails;
  organizationId: string;
  className?: string;
}

export function LeaseHealthBadge({ lease, organizationId, className = '' }: LeaseHealthBadgeProps) {
  const timeline = useLeasePaymentsTimeline(
    lease.id,
    lease.propertyId,
    organizationId,
    lease.paymentDay ?? 5,
    lease.rentAmount,
    lease.chargesRecupMensuelles ?? 0,
    lease.startDate,
    lease.status
  );

  if (timeline.loading) {
    return (
      <span className={`inline-flex items-center gap-1 text-gray-400 text-sm ${className}`}>
        <span className="animate-pulse bg-gray-200 rounded h-4 w-4" />
        —
      </span>
    );
  }

  const health = getLeasePaymentHealthInfo(lease.status, timeline.cockpit.statutGlobal);

  if (health.code === 'OK') {
    return (
      <span className={`inline-flex items-center gap-1 text-green-600 ${className}`} title="Tous les loyers payés">
        <span aria-hidden>🟢</span>
        <span className="text-sm font-medium">OK</span>
      </span>
    );
  }
  if (health.code === 'PARTIEL') {
    return (
      <span className={`inline-flex items-center gap-1 text-amber-600 ${className}`} title="Paiements partiels en cours">
        <span aria-hidden>🟠</span>
        <span className="text-sm font-medium">Partiel</span>
      </span>
    );
  }
  if (health.code === 'RETARD') {
    return (
      <span className={`inline-flex items-center gap-1 text-red-600 ${className}`} title="Retards">
        <span aria-hidden>🔴</span>
        <span className="text-sm font-medium">Retard</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-gray-500 ${className}`} title={health.label}>
      <span aria-hidden>⚪</span>
      <span className="text-sm font-medium">{health.label}</span>
    </span>
  );
}
