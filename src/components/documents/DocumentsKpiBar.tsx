'use client';

import React from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { cn } from '@/utils/cn';

export interface DocumentKpis {
  total: number;
  pending: number;
  unclassified: number;
  ocrFailed: number;
  orphans: number;
}

interface DocumentsKpiBarProps {
  kpis: DocumentKpis;
  activeFilter: string | null;
  onFilterChange: (filter: string | null) => void;
  isLoading?: boolean;
  hideOrphans?: boolean; // Masquer la carte Orphelins (n'a pas de sens dans le contexte d'un bien)
  compact?: boolean; // Cartes petites et compactes
}

export function DocumentsKpiBar({
  kpis,
  activeFilter,
  onFilterChange,
  isLoading = false,
  hideOrphans = false,
  compact = false,
}: DocumentsKpiBarProps) {
  const allCards = [
    {
      id: 'total',
      title: 'Total documents',
      value: kpis.total.toString(),
      iconName: 'FileText',
      color: 'blue' as const,
    },
    {
      id: 'pending',
      title: 'En attente OCR',
      value: kpis.pending.toString(),
      iconName: 'Clock',
      color: 'amber' as const,
    },
    {
      id: 'unclassified',
      title: 'Non classés',
      value: kpis.unclassified.toString(),
      iconName: 'AlertCircle',
      color: 'yellow' as const,
    },
    {
      id: 'ocrFailed',
      title: 'OCR échoué',
      value: kpis.ocrFailed.toString(),
      iconName: 'FileX',
      color: 'red' as const,
    },
    {
      id: 'orphans',
      title: 'Orphelins',
      value: kpis.orphans.toString(),
      iconName: 'AlertTriangle',
      color: 'red' as const,
    },
  ];

  // Filtrer les cartes selon le contexte
  const cards = hideOrphans 
    ? allCards.filter(card => card.id !== 'orphans')
    : allCards;

  const handleCardClick = (cardId: string) => {
    // Envoyer le cardId cliqué au parent
    // Le parent (DocumentsClient) gère la logique de toggle
    onFilterChange(cardId);
  };

  const numberOfCards = cards.length;
  const gridColsClass = hideOrphans 
    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5';

  if (isLoading) {
    return (
      <div className={`grid gap-3 ${gridColsClass} ${compact ? 'grid-cols-2 sm:grid-cols-4' : ''}`}>
        {Array.from({ length: numberOfCards }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'bg-white rounded-lg border border-gray-200 animate-pulse',
              compact ? 'p-3' : 'p-5'
            )}
          >
            <div className={cn('bg-gray-200 rounded', compact ? 'h-3 w-1/2 mb-1.5' : 'h-5 w-1/2 mb-2')}></div>
            <div className={cn('bg-gray-200 rounded', compact ? 'h-5 w-3/4' : 'h-8 w-3/4')}></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-3', gridColsClass, compact && 'grid-cols-2 sm:grid-cols-4')}>
      {cards.map((card) => (
        <StatCard
          key={card.id}
          title={card.title}
          value={card.value}
          iconName={card.iconName}
          color={card.color}
          onClick={() => handleCardClick(card.id)}
          isActive={activeFilter === card.id}
          rightIndicator={compact ? 'none' : 'chevron'}
          trendValue={compact ? undefined : 0}
          trendLabel={compact ? undefined : '% vs mois dernier'}
          trendDirection={compact ? undefined : 'flat'}
          className={compact ? 'p-3 text-sm' : undefined}
        />
      ))}
    </div>
  );
}

