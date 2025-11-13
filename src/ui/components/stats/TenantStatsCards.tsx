'use client';

import React from 'react';
import { Users, UserCheck, UserX, AlertCircle } from 'lucide-react';
import StatCard from '../StatCard';
import StatCardsRow from '../StatCardsRow';
import { useTenantStats } from '../../hooks/useTenantStats';

interface TenantStatsCardsProps {
  propertyId?: string;
  onFilterClick?: (filterType: string) => void;
}

export default function TenantStatsCards({ propertyId, onFilterClick }: TenantStatsCardsProps) {
  const stats = useTenantStats(propertyId);

  return (
    <StatCardsRow>
      <StatCard
        title="Locataires totaux"
        value={stats.isLoading ? '...' : stats.totalTenants}
        subtitle="Dans la base"
        icon={Users}
        iconColor="text-primary"
        iconBgColor="bg-blue-100"
        isLoading={stats.isLoading}
      />
      <StatCard
        title="Avec bail actif"
        value={stats.isLoading ? '...' : stats.withActiveLease}
        subtitle="Occupants actuels"
        icon={UserCheck}
        iconColor="text-success"
        iconBgColor="bg-green-100"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('with-lease') : undefined}
      />
      <StatCard
        title="Sans bail actif"
        value={stats.isLoading ? '...' : stats.withoutActiveLease}
        subtitle="Anciens locataires"
        icon={UserX}
        iconColor="text-base-content opacity-80"
        iconBgColor="bg-base-200"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('without-lease') : undefined}
      />
      <StatCard
        title="Paiements en retard"
        value={stats.isLoading ? '...' : stats.overdue}
        subtitle="À relancer"
        icon={AlertCircle}
        iconColor="text-error"
        iconBgColor="bg-red-100"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('overdue') : undefined}
      />
    </StatCardsRow>
  );
}

