'use client';

import React from 'react';
import { FileText, Receipt, FileCheck, AlertCircle } from 'lucide-react';
import StatCard from '../StatCard';
import StatCardsRow from '../StatCardsRow';
import { useDocumentStats } from '../../hooks/useDocumentStats';

interface DocumentStatsCardsProps {
  propertyId?: string;
  month?: number;
  year?: number;
  onFilterClick?: (filterType: string) => void;
}

export default function DocumentStatsCards({ propertyId, month, year, onFilterClick }: DocumentStatsCardsProps) {
  const stats = useDocumentStats({ propertyId, month, year });

  return (
    <StatCardsRow>
      <StatCard
        title="Documents totaux"
        value={stats.isLoading ? '...' : stats.totalDocuments}
        subtitle="Tous types"
        icon={FileText}
        iconColor="text-primary"
        iconBgColor="bg-blue-100"
        isLoading={stats.isLoading}
      />
      <StatCard
        title="Quittances"
        value={stats.isLoading ? '...' : stats.receipts}
        subtitle="Période sélectionnée"
        icon={Receipt}
        iconColor="text-success"
        iconBgColor="bg-green-100"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('receipts') : undefined}
      />
      <StatCard
        title="Baux signés"
        value={stats.isLoading ? '...' : stats.signedLeases}
        subtitle="Période sélectionnée"
        icon={FileCheck}
        iconColor="text-purple-600"
        iconBgColor="bg-purple-100"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('signed-leases') : undefined}
      />
      <StatCard
        title="En attente d'affectation"
        value={stats.isLoading ? '...' : stats.unassigned}
        subtitle="Non liés"
        icon={AlertCircle}
        iconColor="text-orange-600"
        iconBgColor="bg-orange-100"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('unassigned') : undefined}
      />
    </StatCardsRow>
  );
}

