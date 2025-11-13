'use client';

import React from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { Wallet, TrendingDown, Hash, CheckCircle } from 'lucide-react';

export interface LoansKpis {
  totalPrincipal: number;
  totalCRD: number;
  monthlyPaymentAvg: number;
  activeLoansCount: number;
}

interface LoansKpiBarProps {
  kpis: LoansKpis;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  isLoading?: boolean;
}

export function LoansKpiBar({
  kpis,
  activeFilter,
  onFilterChange,
  isLoading = false,
}: LoansKpiBarProps) {
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
      id: 'principal',
      title: 'Capital Initial Total',
      value: formatCurrency(kpis.totalPrincipal),
      iconName: 'DollarSign',
      color: 'blue' as const,
    },
    {
      id: 'crd',
      title: 'CRD Total',
      value: formatCurrency(kpis.totalCRD),
      iconName: 'TrendingDown',
      color: 'orange' as const,
    },
    {
      id: 'mensualite',
      title: 'Mensualité Moyenne',
      value: formatCurrency(kpis.monthlyPaymentAvg),
      iconName: 'CreditCard',
      color: 'green' as const,
    },
    {
      id: 'actifs',
      title: 'Prêts Actifs',
      value: kpis.activeLoansCount.toString(),
      iconName: 'CheckCircle',
      color: 'purple' as const,
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

