'use client';

import React from 'react';
import { StatCard } from '@/components/ui/StatCard';

export interface LeasesKpis {
  totalLeases: number;
  activeLeases: number;
  expiringSoon: number; // Baux expirant dans les 90 jours
  indexationDue: number; // Indexations à prévoir dans les 30 jours
}

interface LeasesKpiBarProps {
  kpis: LeasesKpis;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  isLoading?: boolean;
  /** Réduit taille / contraste (ex. onglet baux d’un seul bien). */
  variant?: 'default' | 'subtle';
}

export function LeasesKpiBar({
  kpis,
  activeFilter,
  onFilterChange,
  isLoading = false,
  variant = 'default',
}: LeasesKpiBarProps) {
  const subtle = variant === 'subtle';
  const cards = [
    {
      id: 'all',
      title: 'Total de baux',
      value: kpis.totalLeases.toString(),
      iconName: 'FileText',
      color: 'blue' as const,
    },
    {
      id: 'active',
      title: 'Baux actifs',
      value: kpis.activeLeases.toString(),
      iconName: 'CheckCircle',
      color: 'green' as const,
    },
    {
      id: 'expiring',
      title: 'Expirant < 90 jours',
      value: kpis.expiringSoon.toString(),
      iconName: 'Clock',
      color: 'amber' as const,
    },
    {
      id: 'indexation',
      title: 'Indexations à prévoir',
      value: kpis.indexationDue.toString(),
      iconName: 'Calendar',
      color: 'yellow' as const,
    },
  ];

  const handleCardClick = (cardId: string) => {
    // Envoyer le cardId cliqué au parent
    // Le parent (LeasesClient) gère la logique de toggle
    onFilterChange(cardId);
  };

  if (isLoading) {
    return (
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${
          subtle ? 'gap-2 opacity-90' : 'gap-4'
        }`}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`bg-white rounded-lg border border-gray-100 animate-pulse ${
              subtle ? 'p-3' : 'rounded-xl border-gray-200 p-5'
            }`}
          >
            <div className={`bg-gray-200 rounded w-1/2 mb-2 ${subtle ? 'h-3' : 'h-5'}`}></div>
            <div className={`bg-gray-200 rounded w-3/4 ${subtle ? 'h-6' : 'h-8'}`}></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${
        subtle ? 'gap-2 opacity-[0.92]' : 'gap-4'
      }`}
    >
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
          className={
            subtle
              ? '!p-3 md:!p-3 !rounded-lg border-gray-100/90 shadow-sm saturate-[0.85]'
              : undefined
          }
        />
      ))}
    </div>
  );
}
