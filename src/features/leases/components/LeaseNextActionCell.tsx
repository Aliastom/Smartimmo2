'use client';

import React from 'react';
import { useLeasePaymentsTimeline } from '../hooks/useLeasePaymentsTimeline';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import {
  getNextLeaseAction,
  getNextLeaseActionShortLabel,
  toLeaseForNextAction,
} from '../utils/getNextLeaseAction';
import { useLeaseIndexationStatus } from '../hooks/useLeaseIndexationStatus';

interface LeaseNextActionCellProps {
  lease: LeaseWithDetails;
  organizationId: string;
  className?: string;
}

/**
 * Colonne « À faire » : même timeline que Santé, sans signal quittance (non disponible en liste).
 */
export function LeaseNextActionCell({ lease, organizationId, className = '' }: LeaseNextActionCellProps) {
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
  const indexation = useLeaseIndexationStatus(lease);

  if (timeline.loading) {
    return (
      <span className={`text-xs text-gray-400 ${className}`}>
        <span className="inline-block animate-pulse bg-gray-200 rounded h-3 w-16" />
      </span>
    );
  }

  const action = getNextLeaseAction(toLeaseForNextAction(lease), timeline, {
    indexationStatus: indexation.status,
  });
  const short = getNextLeaseActionShortLabel(action);

  return (
    <span className={`text-sm font-medium text-gray-800 ${className}`} title={action.label}>
      {short}
    </span>
  );
}
