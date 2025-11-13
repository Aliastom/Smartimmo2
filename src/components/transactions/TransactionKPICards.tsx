'use client';

import React from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';

interface TransactionMetrics {
  total: number;
  recettes: number;
  depenses: number;
  nonRapprochees: number;
  anomalies: number;
  echeances: number;
}

interface TransactionKPICardsProps {
  metrics: TransactionMetrics;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
}

const KPI_CARDS = [
  {
    id: 'total',
    title: 'Total Transactions',
    value: 'total',
    iconName: 'FileText',
    color: 'primary' as const,
    description: 'Toutes les transactions'
  },
  {
    id: 'recettes',
    title: 'Recettes',
    value: 'recettes',
    iconName: 'TrendingUp',
    color: 'success' as const,
    description: 'Nature = Recette'
  },
  {
    id: 'depenses',
    title: 'Dépenses',
    value: 'depenses',
    iconName: 'TrendingDown',
    color: 'danger' as const,
    description: 'Nature = Dépense'
  },
  {
    id: 'nonRapprochees',
    title: 'Non Rapprochées',
    value: 'nonRapprochees',
    iconName: 'AlertCircle',
    color: 'warning' as const,
    description: 'Sans document lié'
  },
  {
    id: 'anomalies',
    title: 'Anomalies',
    value: 'anomalies',
    iconName: 'AlertCircle',
    color: 'danger' as const,
    description: 'Catégorie manquante, montant nul'
  },
  {
    id: 'echeances',
    title: 'Échéances',
    value: 'echeances',
    iconName: 'Calendar',
    color: 'warning' as const,
    description: 'Transactions à venir (30 jours)'
  }
];

export default function TransactionKPICards({ 
  metrics, 
  activeFilter, 
  onFilterChange 
}: TransactionKPICardsProps) {
  // Force recompilation
  const formatValue = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      {KPI_CARDS.map((card) => {
        const isActive = activeFilter === card.id;
        const value = metrics[card.value as keyof TransactionMetrics];
        
        const handleClick = () => {
          // Si la carte est déjà active, on la désactive (retour au total)
          if (isActive) {
            onFilterChange(null);
          } else {
            onFilterChange(card.id);
          }
        };
        
        return (
          <div
            key={card.id}
            className="cursor-pointer transition-all duration-200 transform hover:scale-105"
            onClick={handleClick}
          >
            <StatCard
              title={card.title}
              value={formatValue(value)}
              iconName={card.iconName}
              color={card.color}
              className={isActive ? 'ring-2 ring-blue-500 ring-opacity-75 shadow-lg scale-105' : ''}
            />
            <div className="mt-2 text-center">
              <p className="text-xs text-gray-500">
                {card.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
