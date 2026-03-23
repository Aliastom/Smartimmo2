'use client';

import React from 'react';
import { AlertTriangle, Clock, Calendar, Banknote } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { LeasesActionCounts } from '../hooks/useLeasesActionCounts';

export type ActionFilterKey = 'partiels' | 'retards' | 'expirant90' | 'indexations' | null;

interface LeasesActionBannerProps {
  counts: LeasesActionCounts;
  activeFilter: ActionFilterKey;
  onFilterChange: (filter: ActionFilterKey) => void;
  isLoading?: boolean;
}

const CARDS: Array<{
  key: ActionFilterKey;
  label: string;
  countKey: keyof LeasesActionCounts;
  icon: React.ElementType;
  bgColor: string;
  borderColor: string;
  textColor: string;
  hoverBg: string;
}> = [
  {
    key: 'partiels',
    label: 'Paiements partiels',
    countKey: 'partiels',
    icon: AlertTriangle,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800',
    hoverBg: 'hover:bg-amber-100',
  },
  {
    key: 'retards',
    label: 'Retards',
    countKey: 'retards',
    icon: Banknote,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
    hoverBg: 'hover:bg-red-100',
  },
  {
    key: 'expirant90',
    label: 'Expirant < 90 jours',
    countKey: 'expirant90',
    icon: Clock,
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-800',
    hoverBg: 'hover:bg-orange-100',
  },
  {
    key: 'indexations',
    label: 'Indexations à prévoir',
    countKey: 'indexations',
    icon: Calendar,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
    hoverBg: 'hover:bg-blue-100',
  },
];

export function LeasesActionBanner({
  counts,
  activeFilter,
  onFilterChange,
  isLoading = false,
}: LeasesActionBannerProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">À traiter</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 rounded-lg bg-gray-200 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const totalActionable =
    counts.partiels + counts.retards + counts.expirant90 + counts.indexations;

  if (totalActionable === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-green-50/80 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">À traiter</h3>
        <p className="text-sm text-green-700">Aucune action requise pour le moment.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">À traiter</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CARDS.map((card) => {
          const count = counts[card.countKey] as number;
          const Icon = card.icon;
          const isActive = activeFilter === card.key;

          return (
            <button
              key={card.key}
              type="button"
              onClick={() =>
                onFilterChange(isActive ? null : (card.key as ActionFilterKey))
              }
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                card.bgColor,
                card.borderColor,
                card.hoverBg,
                isActive && 'ring-2 ring-offset-1 ring-orange-400'
              )}
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  card.bgColor,
                  card.textColor
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn('text-xs font-medium truncate', card.textColor)}>
                  {card.label}
                </p>
                <p className="text-lg font-bold text-gray-900">{count}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
