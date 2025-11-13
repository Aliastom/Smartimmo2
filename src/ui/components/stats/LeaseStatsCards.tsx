'use client';

import React from 'react';
import { FileText, CheckCircle, Clock, Euro } from 'lucide-react';
import StatCard from '../StatCard';
import StatCardsRow from '../StatCardsRow';
import { useLeaseStats } from '../../hooks/useLeaseStats';
import { formatCurrencyEUR } from '@/utils/format';

interface LeaseStatsCardsProps {
  propertyId?: string;
  onFilterClick?: (filterType: string) => void;
}

export default function LeaseStatsCards({ propertyId, onFilterClick }: LeaseStatsCardsProps) {
  const stats = useLeaseStats(propertyId);

  return (
    <StatCardsRow>
      <StatCard
        title="Baux totaux"
        value={stats.isLoading ? '...' : stats.totalLeases}
        subtitle="Tous statuts confondus"
        icon={FileText}
        iconColor="text-primary"
        iconBgColor="bg-blue-100"
        isLoading={stats.isLoading}
      />
      <StatCard
        title="Actifs"
        value={stats.isLoading ? '...' : stats.activeLeases}
        subtitle="En cours"
        icon={CheckCircle}
        iconColor="text-success"
        iconBgColor="bg-green-100"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('active') : undefined}
      />
      <StatCard
        title="Échéances < 60j"
        value={stats.isLoading ? '...' : stats.expiringIn60Days}
        subtitle="À renouveler bientôt"
        icon={Clock}
        iconColor="text-orange-600"
        iconBgColor="bg-orange-100"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('expiring-soon') : undefined}
      />
      <StatCard
        title="Loyer mensuel total"
        value={stats.isLoading ? '...' : formatCurrencyEUR(stats.totalMonthlyRent)}
        subtitle="Baux actifs"
        icon={Euro}
        iconColor="text-emerald-600"
        iconBgColor="bg-emerald-100"
        isLoading={stats.isLoading}
      />
    </StatCardsRow>
  );
}

