'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { TrendingUp } from 'lucide-react';
import type { IndexationATraiter } from '@/types/dashboard';
import { cn } from '@/utils/cn';

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export interface OptimisationPossibleCardProps {
  indexations: IndexationATraiter[];
  className?: string;
}

export function OptimisationPossibleCard({ indexations, className }: OptimisationPossibleCardProps) {
  const first = indexations.find((i) => i.loyerPropose != null && i.loyerActuel > 0) ?? indexations[0];
  if (!first) return null;

  const delta = first.loyerPropose != null ? first.loyerPropose - first.loyerActuel : 0;
  const gainAn = Math.round(delta * 12);
  const gainMois = Math.round(delta);
  const label = first.loyerPropose != null
    ? `Augmenter loyer ${first.propertyName} de ${formatEur(delta)}`
    : `Augmenter loyer ${first.propertyName}`;
  const hasImpact = gainAn > 0 || gainMois > 0;

  return (
    <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-800">Optimisation possible</h3>
        </div>
        <p className="text-sm font-medium text-slate-700 mb-1">{label}</p>
        {hasImpact && (
          <>
            <p className="text-xs text-slate-600 mb-2">Impact estimé :</p>
            <ul className="text-sm text-emerald-700 font-medium space-y-0.5">
              <li>+{formatEur(gainAn)} / an</li>
              <li>+{formatEur(gainMois)} / mois</li>
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
