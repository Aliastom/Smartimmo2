'use client';

import React from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';

export interface TransactionKpis {
  recettesTotales: number;
  depensesTotales: number;
  soldeNet: number;
  nonRapprochees: number;
  /** Cashflow mensuel moyen (total soldes mensuels / nombre de mois) */
  cashflowMensuelMoyen?: number;
  /** Nombre de mois utilisés pour le calcul */
  cashflowMoisCount?: number;
}

interface TransactionsKpiBarProps {
  kpis: TransactionKpis;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  isLoading?: boolean;
}

export function TransactionsKpiBar({
  kpis,
  activeFilter,
  onFilterChange,
  isLoading = false,
}: TransactionsKpiBarProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const cashflowMoisCount = kpis.cashflowMoisCount ?? 0;
  const cashflowMoyen = kpis.cashflowMensuelMoyen ?? 0;
  const projectionAnnuelle = cashflowMoyen * 12;
  const formatCashflow = (amount: number) =>
    (amount >= 0 ? '+' : '') + formatCurrency(amount);
  const hasCashflowData = cashflowMoisCount > 0;
  const cashflowValue = hasCashflowData ? formatCashflow(cashflowMoyen) : '—';
  const cashflowSubtitle = hasCashflowData
    ? `calculé sur ${cashflowMoisCount} mois\nProjection annuelle ${formatCashflow(projectionAnnuelle)}`
    : undefined;

  const cards = [
    {
      id: 'recettes',
      title: 'Recettes totales',
      value: formatCurrency(kpis.recettesTotales),
      iconName: 'TrendingUp',
      color: 'green' as const,
      subtitle: undefined as string | undefined,
    },
    {
      id: 'depenses',
      title: 'Dépenses totales',
      value: formatCurrency(Math.abs(kpis.depensesTotales)),
      iconName: 'TrendingDown',
      color: 'red' as const,
      subtitle: undefined as string | undefined,
    },
    {
      id: 'solde',
      title: 'Solde net',
      value: formatCurrency(kpis.soldeNet),
      iconName: 'Activity',
      color: kpis.soldeNet >= 0 ? ('blue' as const) : ('red' as const),
      subtitle: undefined as string | undefined,
    },
    {
      id: 'cashflow',
      title: 'Cashflow mensuel moyen (12 mois)',
      value: cashflowValue,
      iconName: 'Euro',
      color: hasCashflowData ? (cashflowMoyen >= 0 ? ('green' as const) : ('red' as const)) : ('gray' as const),
      subtitle: cashflowSubtitle,
    },
    {
      id: 'nonRapprochees',
      title: 'Transactions non rapprochées',
      value: kpis.nonRapprochees.toString(),
      iconName: 'Clock',
      color: 'yellow' as const,
      subtitle: undefined as string | undefined,
    },
  ];

  const handleCardClick = (cardId: string) => {
    // Envoyer le cardId cliqué au parent
    // Le parent (TransactionsClient) gère la logique de toggle
    onFilterChange(cardId);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
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
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <StatCard
          key={card.id}
          title={card.title}
          value={card.value}
          iconName={card.iconName}
          color={card.color}
          subtitle={card.subtitle}
          onClick={() => handleCardClick(card.id)}
          isActive={activeFilter === card.id}
          rightIndicator="none"
        />
      ))}
    </div>
  );
}

