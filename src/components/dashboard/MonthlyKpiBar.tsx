'use client';

import React from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { Euro, TrendingUp, TrendingDown, Activity, FileCheck2, Home } from 'lucide-react';
import type { MonthlyKPIs } from '@/types/dashboard';

export interface MonthlyKpiBarProps {
  kpis: MonthlyKPIs;
  isLoading?: boolean;
}

export function MonthlyKpiBar({ kpis, isLoading = false }: MonthlyKpiBarProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyWithDecimals = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getTrendDirection = (delta: number): 'up' | 'down' | 'flat' => {
    if (delta > 0) return 'up';
    if (delta < 0) return 'down';
    return 'flat';
  };

  const cards = [
    {
      id: 'loyers',
      title: 'Loyers encaissés',
      value: formatCurrency(kpis.loyersEncaisses),
      iconName: 'Euro',
      color: 'green' as const,
      trendValue: kpis.deltaLoyersEncaisses,
      trendLabel: `${kpis.deltaLoyersEncaisses >= 0 ? '+' : ''}${formatCurrencyWithDecimals(kpis.deltaLoyersEncaisses)}`,
      trendDirection: getTrendDirection(kpis.deltaLoyersEncaisses),
    },
    {
      id: 'charges',
      title: 'Charges payées',
      value: formatCurrency(kpis.chargesPayees),
      iconName: 'TrendingDown',
      color: 'red' as const,
      trendValue: kpis.deltaChargesPayees,
      trendLabel: `${kpis.deltaChargesPayees >= 0 ? '+' : ''}${formatCurrencyWithDecimals(kpis.deltaChargesPayees)}`,
      trendDirection: getTrendDirection(kpis.deltaChargesPayees),
    },
    {
      id: 'cashflow',
      title: 'Cashflow du mois',
      value: formatCurrency(kpis.cashflow),
      iconName: 'Activity',
      color: kpis.cashflow >= 0 ? ('blue' as const) : ('red' as const),
      trendValue: kpis.deltaCashflow,
      trendLabel: `${kpis.deltaCashflow >= 0 ? '+' : ''}${formatCurrencyWithDecimals(kpis.deltaCashflow)}`,
      trendDirection: getTrendDirection(kpis.deltaCashflow),
    },
    {
      id: 'taux',
      title: "Taux d'encaissement",
      value: formatPercentage(kpis.tauxEncaissement),
      iconName: 'TrendingUp',
      color: kpis.tauxEncaissement >= 90 ? ('green' as const) : kpis.tauxEncaissement >= 70 ? ('yellow' as const) : ('red' as const),
      trendValue: kpis.deltaTauxEncaissement,
      trendLabel: `${kpis.deltaTauxEncaissement >= 0 ? '+' : ''}${kpis.deltaTauxEncaissement.toFixed(2)}%`,
      trendDirection: getTrendDirection(kpis.deltaTauxEncaissement),
      progressValue: kpis.tauxEncaissement,
      rightIndicator: 'progress' as const,
    },
    {
      id: 'baux',
      title: 'Baux actifs',
      value: kpis.bauxActifs.toString(),
      iconName: 'Home',
      color: 'blue' as const,
      trendValue: 0,
      trendLabel: 'stable',
      trendDirection: 'flat' as const,
    },
    {
      id: 'documents',
      title: 'Documents envoyés',
      value: kpis.documentsEnvoyes.toString(),
      iconName: 'FileCheck2',
      color: 'indigo' as const,
      trendValue: 0,
      trendLabel: 'ce mois',
      trendDirection: 'flat' as const,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
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
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.slice(0, 5).map((card) => (
        <StatCard
          key={card.id}
          title={card.title}
          value={card.value}
          iconName={card.iconName}
          color={card.color}
          trendValue={card.trendValue}
          trendLabel={card.trendLabel}
          trendDirection={card.trendDirection}
          rightIndicator={card.rightIndicator}
          progressValue={card.progressValue}
        />
      ))}
    </div>
  );
}

