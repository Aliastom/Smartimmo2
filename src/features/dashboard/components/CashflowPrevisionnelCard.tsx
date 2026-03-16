'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Euro } from 'lucide-react';
import type { MonthlyKPIs } from '@/types/dashboard';
import type { IntraMensuelDataPoint } from '@/types/dashboard';
import { cn } from '@/utils/cn';

export interface CashflowPrevisionnelCardProps {
  kpis: MonthlyKPIs;
  /** Données intra-mensuelles pour le mini graphique encaissements attendus vs réalisés */
  intraMensuel?: IntraMensuelDataPoint[];
  currentMonth: string;
  className?: string;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

export function CashflowPrevisionnelCard({
  kpis,
  intraMensuel = [],
  currentMonth,
  className,
}: CashflowPrevisionnelCardProps) {
  const cashflow = kpis.cashflow ?? 0;
  const loyersAttendus = kpis.loyersAttendus ?? 0;
  const encaissementsRealises = kpis.sommesEncaissesRapprochees ?? 0;
  /** Prévision fin de mois : on garde les réalisés + une part des attendus restants (estimation simple = attendus pour comparaison visuelle) */
  const previsionFinMois = loyersAttendus;
  const maxBar = Math.max(loyersAttendus, encaissementsRealises, previsionFinMois, 1);
  const pctRealises = maxBar > 0 ? (encaissementsRealises / maxBar) * 100 : 0;
  const pctPrevision = maxBar > 0 ? (previsionFinMois / maxBar) * 100 : 0;

  return (
    <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
      <CardContent className="py-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
            <Euro className="h-5 w-5" aria-hidden />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Cashflow prévisionnel du mois</h3>
        </div>
        <p className="text-2xl font-bold tabular-nums text-slate-900">
          {cashflow >= 0 ? '+' : ''}{formatEur(cashflow)}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Loyers attendus − charges − remboursements − dépenses
        </p>
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-600 mb-2">Barre comparative</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-20 shrink-0">Attendu</span>
              <div className="flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-slate-300" style={{ width: '100%' }} />
              </div>
              <span className="text-xs font-medium tabular-nums w-16 text-right">{formatEur(loyersAttendus)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-20 shrink-0">Réalisé</span>
              <div className="flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    encaissementsRealises >= loyersAttendus * 0.8 ? 'bg-emerald-500' : encaissementsRealises >= loyersAttendus * 0.5 ? 'bg-amber-500' : 'bg-red-500'
                  )}
                  style={{ width: `${pctRealises}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums w-16 text-right">{formatEur(encaissementsRealises)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-20 shrink-0">Prévision</span>
              <div className="flex-1 h-4 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${pctPrevision}%` }} />
              </div>
              <span className="text-xs font-medium tabular-nums w-16 text-right">{formatEur(previsionFinMois)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
