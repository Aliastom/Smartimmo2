'use client';

import React from 'react';
import type { LeaseWithDetails } from '@/lib/services/leasesService';
import { useLeaseIndexationStatus } from '../hooks/useLeaseIndexationStatus';

interface LeaseIndexationRowBadgeProps {
  lease: LeaseWithDetails;
  className?: string;
}

/**
 * Badge de repérage ultra léger pour le tableau.
 * - DUE: visible "À indexer"
 * - UPCOMING: discret "Bientôt"
 * - NONE/APPLIED: rien
 */
export function LeaseIndexationRowBadge({ lease, className = '' }: LeaseIndexationRowBadgeProps) {
  const indexation = useLeaseIndexationStatus(lease);

  if (indexation.status === 'DUE') {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 border border-blue-200 ${className}`}
        title="Indexation due"
      >
        À indexer
      </span>
    );
  }

  if (indexation.status === 'UPCOMING') {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600 border border-gray-200 ${className}`}
        title="Indexation bientôt"
      >
        Bientôt
      </span>
    );
  }

  return null;
}

