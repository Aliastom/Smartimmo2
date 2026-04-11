'use client';

import React from 'react';
import { cn } from '@/utils/cn';
import type { LeasesActionCounts } from '../hooks/useLeasesActionCounts';
import type { ActionFilterKey } from './LeasesActionBanner';

interface LeasesTableFilterStripProps {
  counts: LeasesActionCounts;
  activeFilter: ActionFilterKey;
  onFilterChange: (key: ActionFilterKey) => void;
  disabled?: boolean;
}

export function LeasesTableFilterStrip({
  counts,
  activeFilter,
  onFilterChange,
  disabled,
}: LeasesTableFilterStripProps) {
  const items: Array<{ key: ActionFilterKey; label: string; n: number }> = [
    { key: 'retards', label: 'Retards', n: counts.retards },
    { key: 'partiels', label: 'Partiels', n: counts.partiels },
    { key: 'expirant90', label: 'Échéance < 90 j', n: counts.expirant90 },
    { key: 'indexations', label: 'Indexations', n: counts.indexations },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 text-sm border-b border-gray-100 mb-3">
      <span className="text-gray-500 shrink-0">Filtrer :</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onFilterChange(null)}
        className={cn(
          'px-2.5 py-1 rounded-md border text-xs font-medium transition-colors',
          activeFilter === null
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        )}
      >
        Tous
      </button>
      {items.map(({ key, label, n }) => (
        <button
          key={key || 'x'}
          type="button"
          disabled={disabled || n === 0}
          onClick={() => onFilterChange(activeFilter === key ? null : key)}
          className={cn(
            'px-2.5 py-1 rounded-md border text-xs font-medium transition-colors',
            activeFilter === key
              ? 'bg-orange-100 text-orange-900 border-orange-300'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
            n === 0 && 'opacity-40 cursor-not-allowed'
          )}
        >
          {label} ({n})
        </button>
      ))}
    </div>
  );
}
