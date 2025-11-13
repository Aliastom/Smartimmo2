'use client';

import React from 'react';
import { Landmark, DollarSign, TrendingDown, Clock } from 'lucide-react';
import StatCard from '../StatCard';
import StatCardsRow from '../StatCardsRow';
import { useLoanStats } from '../../hooks/useLoanStats';
import { formatCurrencyEUR } from '@/utils/format';
import { useSearchParams } from 'next/navigation';

interface LoanStatsCardsProps {
  propertyId?: string;
  month?: number;
  year?: number;
  onFilterClick?: (filterType: string) => void;
}

export default function LoanStatsCards({ propertyId, month, year, onFilterClick }: LoanStatsCardsProps) {
  const stats = useLoanStats({ propertyId, month, year });
  const searchParams = useSearchParams();
  
  // Vérifier si le filtre "due-soon" est actif
  const isDueSoonActive = searchParams.get('filter') === 'due-soon';

  return (
    <StatCardsRow>
      <StatCard
        title="Nombre de prêts"
        value={stats.isLoading ? '...' : stats.totalLoans}
        subtitle="Actifs"
        icon={Landmark}
        iconColor="text-primary"
        iconBgColor="bg-blue-100"
        isLoading={stats.isLoading}
      />
      <StatCard
        title="Capital restant dû"
        value={stats.isLoading ? '...' : formatCurrencyEUR(stats.totalRemainingCapital)}
        subtitle="Total à rembourser"
        icon={DollarSign}
        iconColor="text-purple-600"
        iconBgColor="bg-purple-100"
        isLoading={stats.isLoading}
      />
      <StatCard
        title="Intérêts payés"
        value={stats.isLoading ? '...' : formatCurrencyEUR(stats.interestPaid)}
        subtitle="Période sélectionnée"
        icon={TrendingDown}
        iconColor="text-orange-600"
        iconBgColor="bg-orange-100"
        isLoading={stats.isLoading}
      />
      <StatCard
        title="Échéances < 60j"
        value={stats.isLoading ? '...' : stats.dueSoon}
        subtitle="Prêts arrivant à terme"
        icon={Clock}
        iconColor="text-error"
        iconBgColor="bg-red-100"
        isLoading={stats.isLoading}
        onClick={onFilterClick ? () => onFilterClick('due-soon') : undefined}
        className={isDueSoonActive ? 'ring-2 ring-blue-500 ring-opacity-75 shadow-lg scale-105' : ''}
      />
    </StatCardsRow>
  );
}

