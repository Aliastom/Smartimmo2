'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Target } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface ProgressionMoisCardProps {
  /** Nombre d'actions traitées (ex. 0 si pas de suivi) */
  actionsTraitees: number;
  /** Nombre total d'actions à traiter */
  totalActions: number;
  className?: string;
}

export function ProgressionMoisCard({
  actionsTraitees,
  totalActions,
  className,
}: ProgressionMoisCardProps) {
  const pct = totalActions > 0 ? Math.round((actionsTraitees / totalActions) * 100) : 0;

  return (
    <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-4 w-4 text-slate-500" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-800">Progression du mois</h3>
        </div>
        <p className="text-lg font-bold text-slate-900 tabular-nums">
          Actions traitées : {actionsTraitees} / {totalActions}
        </p>
        <div className="mt-2">
          <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
