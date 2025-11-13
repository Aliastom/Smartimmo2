'use client';

import React from 'react';
import { Building2, Home, KeyRound, Euro } from 'lucide-react';
import StatCard from '../StatCard';
import StatCardsRow from '../StatCardsRow';
import { usePropertyStats } from '../../hooks/usePropertyStats';
import { formatCurrencyEUR } from '@/utils/format';

interface PropertyStatsCardsProps {
  propertyId?: string;
  onFilterClick?: (filterType: string) => void;
}

export default function PropertyStatsCards({ propertyId, onFilterClick }: PropertyStatsCardsProps) {
  const stats = usePropertyStats(propertyId);

  if (propertyId) {
    // Stats pour un bien spécifique
    return (
      <StatCardsRow>
        <StatCard
          title="Baux actifs"
          value={stats.isLoading ? '...' : stats.totalProperties}
          subtitle="Contrats en cours"
          icon={KeyRound}
          iconColor="text-primary"
          iconBgColor="bg-blue-100"
          isLoading={stats.isLoading}
          onClick={onFilterClick ? () => onFilterClick('active-leases') : undefined}
        />
        <StatCard
          title="Loyers mensuels"
          value={stats.isLoading ? '...' : formatCurrencyEUR(stats.totalMonthlyRent)}
          subtitle="Total HC + charges"
          icon={Euro}
          iconColor="text-success"
          iconBgColor="bg-green-100"
          isLoading={stats.isLoading}
        />
        <StatCard
          title="Échéances < 60j"
          value={stats.isLoading ? '...' : (stats as any).expiringIn60Days || 0}
          subtitle="Baux arrivant à terme"
          icon={Home}
          iconColor="text-orange-600"
          iconBgColor="bg-orange-100"
          isLoading={stats.isLoading}
          onClick={onFilterClick ? () => onFilterClick('expiring-soon') : undefined}
        />
        <StatCard
          title="Documents liés"
          value={stats.isLoading ? '...' : (stats as any).totalDocuments || 0}
          subtitle="Fichiers attachés"
          icon={Building2}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
          isLoading={stats.isLoading}
        />
      </StatCardsRow>
    );
  }

  // Stats globales
  return (
    <StatCardsRow>
      <StatCard
        title="Biens totaux"
        value={stats.isLoading ? '...' : stats.totalProperties}
        subtitle="Dans votre patrimoine"
        icon={Building2}
        iconColor="text-primary"
        iconBgColor="bg-blue-100"
        isLoading={stats.isLoading}
      />
      <StatCard
        title="Occupés"
        value={stats.isLoading ? '...' : stats.occupied}
        subtitle="Biens loués"
        icon={Home}
        iconColor="text-success"
        iconBgColor="bg-green-100"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('occupied') : undefined}
      />
      <StatCard
        title="Vacants"
        value={stats.isLoading ? '...' : stats.vacant}
        subtitle="Disponibles"
        icon={KeyRound}
        iconColor="text-orange-600"
        iconBgColor="bg-orange-100"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('vacant') : undefined}
      />
      <StatCard
        title="Loyer mensuel total"
        value={stats.isLoading ? '...' : formatCurrencyEUR(stats.totalMonthlyRent)}
        subtitle="Biens loués"
        icon={Euro}
        iconColor="text-emerald-600"
        iconBgColor="bg-emerald-100"
        isLoading={stats.isLoading}
      />
    </StatCardsRow>
  );
}

