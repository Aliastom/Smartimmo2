'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Activity } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface SantePortefeuilleCardProps {
  /** Niveau de risque : 'low' | 'medium' | 'high' */
  riskLevel: 'low' | 'medium' | 'high';
  nLoyersRetard: number;
  nTransactionsNonRapprochees: number;
  nIndexationsEnAttente: number;
  className?: string;
}

const RISK_LABEL: Record<SantePortefeuilleCardProps['riskLevel'], string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
};

const RISK_CLASS: Record<SantePortefeuilleCardProps['riskLevel'], string> = {
  low: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  medium: 'bg-amber-50 border-amber-200 text-amber-700',
  high: 'bg-red-50 border-red-200 text-red-700',
};

export function SantePortefeuilleCard({
  riskLevel,
  nLoyersRetard,
  nTransactionsNonRapprochees,
  nIndexationsEnAttente,
  className,
}: SantePortefeuilleCardProps) {
  const lines = [
    nLoyersRetard > 0 && `${nLoyersRetard} loyer${nLoyersRetard > 1 ? 's' : ''} en retard`,
    nTransactionsNonRapprochees > 0 && `${nTransactionsNonRapprochees} transaction${nTransactionsNonRapprochees > 1 ? 's' : ''} non rapprochée${nTransactionsNonRapprochees > 1 ? 's' : ''}`,
    nIndexationsEnAttente > 0 && `${nIndexationsEnAttente} indexation${nIndexationsEnAttente > 1 ? 's' : ''} en attente`,
  ].filter(Boolean) as string[];

  return (
    <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-slate-600" aria-hidden />
          <h3 className="text-sm font-semibold text-slate-800">Santé du portefeuille</h3>
        </div>
        <p className="text-xs font-medium text-slate-600 mb-2">
          Risque global : <span className={cn('font-semibold', riskLevel === 'high' && 'text-red-700', riskLevel === 'medium' && 'text-amber-700', riskLevel === 'low' && 'text-emerald-700')}>{RISK_LABEL[riskLevel]}</span>
        </p>
        <div className={cn('rounded-lg border px-3 py-2', RISK_CLASS[riskLevel])}>
          {lines.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun point d&#39;attention.</p>
          ) : (
            <ul className="text-sm space-y-0.5">
              {lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
