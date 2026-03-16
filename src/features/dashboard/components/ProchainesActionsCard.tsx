'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { ArrowRight, AlertCircle, FileSearch, Percent, CalendarCheck } from 'lucide-react';
import type { LoyerNonEncaisse, TransactionNonRapprochee, IndexationATraiter } from '@/types/dashboard';
import { cn } from '@/utils/cn';

export interface ProchainesActionsCardProps {
  relances: LoyerNonEncaisse[];
  transactionsNonRapprochees: TransactionNonRapprochee[];
  indexations: IndexationATraiter[];
  echeancesCount: number;
  className?: string;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export function ProchainesActionsCard({
  relances,
  transactionsNonRapprochees,
  indexations,
  echeancesCount,
  className,
}: ProchainesActionsCardProps) {
  const relancesAmount = relances.reduce((s, r) => s + r.montant, 0);
  const txAmount = transactionsNonRapprochees.reduce((s, t) => s + t.montant, 0);

  const actions = [
    relances.length > 0 && {
      id: 'loyers',
      icon: AlertCircle,
      label: `Relancer ${relances.length} locataire${relances.length > 1 ? 's' : ''}`,
      detail: `Montant concerné : ${formatEur(relancesAmount)}`,
      href: '/app?view=alertes&type=loyers_retard',
      buttonLabel: 'Voir les loyers',
      color: 'red',
      priority: 'Élevée' as const,
    },
    transactionsNonRapprochees.length > 0 && {
      id: 'transactions',
      icon: FileSearch,
      label: `Rapprocher ${transactionsNonRapprochees.length} transaction${transactionsNonRapprochees.length > 1 ? 's' : ''}`,
      detail: `Montant total : ${formatEur(txAmount)}`,
      href: '/app?view=alertes&type=transactions',
      buttonLabel: 'Voir les transactions',
      color: 'orange',
      priority: 'Moyenne' as const,
    },
    indexations.length > 0 && {
      id: 'indexations',
      icon: Percent,
      label: `Appliquer ${indexations.length} indexation${indexations.length > 1 ? 's' : ''}`,
      detail: 'Mise à jour des loyers',
      href: '/app?view=alertes&type=indexations',
      buttonLabel: 'Voir les indexations',
      color: 'blue',
      priority: 'Normale' as const,
    },
    echeancesCount > 0 && {
      id: 'echeances',
      icon: CalendarCheck,
      label: `Vérifier ${echeancesCount} échéance${echeancesCount > 1 ? 's' : ''}`,
      detail: 'Prêts et charges',
      href: '/app?view=alertes&type=echeances',
      buttonLabel: 'Voir les échéances',
      color: 'emerald',
      priority: 'Normale' as const,
    },
  ].filter(Boolean) as Array<{
    id: string;
    icon: React.ElementType;
    label: string;
    detail: string;
    href: string;
    buttonLabel: string;
    color: string;
    priority: 'Élevée' | 'Moyenne' | 'Normale';
  }>;

  if (actions.length === 0) {
    return (
      <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
        <CardContent className="py-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Prochaines actions recommandées</h3>
          <p className="text-sm text-slate-500">Aucune action urgente.</p>
        </CardContent>
      </Card>
    );
  }

  const colorClasses: Record<string, string> = {
    red: 'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-amber-50 border-amber-200 text-amber-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };

  const priorityBadgeClass: Record<string, string> = {
    Élevée: 'bg-red-100 text-red-700 border-red-200',
    Moyenne: 'bg-amber-100 text-amber-700 border-amber-200',
    Normale: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
      <CardContent className="py-3">
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Prochaines actions recommandées</h3>
        <ul className="space-y-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <li
                key={action.id}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5',
                  colorClasses[action.color] || 'bg-slate-50 border-slate-200'
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="flex-shrink-0 rounded bg-white/80 p-1">
                    <Icon className="h-3.5 w-3.5 text-slate-600" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">{action.label}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{action.detail}</p>
                  </div>
                  <span
                    className={cn(
                      'flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase',
                      priorityBadgeClass[action.priority]
                    )}
                  >
                    {action.priority}
                  </span>
                </div>
                <Link
                  href={action.href}
                  className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 flex-shrink-0"
                >
                  {action.buttonLabel}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
