'use client';

import React from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { TrendingUp, TrendingDown, Calendar, CheckCircle } from 'lucide-react';

export interface EcheanceKpis {
  revenusAnnuels: number;
  chargesAnnuelles: number;
  totalEcheances: number;
  echeancesActives: number;
}

interface EcheancesKpiBarProps {
  kpis: EcheanceKpis;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  isLoading?: boolean;
}

export function EcheancesKpiBar({
  kpis,
  activeFilter,
  onFilterChange,
  isLoading = false,
}: EcheancesKpiBarProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const cards = [
    {
      id: 'revenus',
      title: 'Revenus annuels',
      value: formatCurrency(kpis.revenusAnnuels),
      iconName: 'TrendingUp',
      color: 'green' as const,
    },
    {
      id: 'charges',
      title: 'Charges annuelles',
      value: formatCurrency(kpis.chargesAnnuelles),
      iconName: 'TrendingDown',
      color: 'red' as const,
    },
    {
      id: 'total',
      title: 'Total échéances',
      value: kpis.totalEcheances.toString(),
      iconName: 'Calendar',
      color: 'blue' as const,
    },
    {
      id: 'actives',
      title: 'Échéances actives',
      value: kpis.echeancesActives.toString(),
      iconName: 'CheckCircle',
      color: 'yellow' as const,
    },
  ];

  const handleCardClick = (cardId: string) => {
    onFilterChange(cardId);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse"
          >
            <div className="h-5 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <StatCard
          key={card.id}
          title={card.title}
          value={card.value}
          iconName={card.iconName}
          color={card.color}
          onClick={() => handleCardClick(card.id)}
          isActive={activeFilter === card.id}
          rightIndicator="none"
        />
      ))}
    </div>
  );
}

