'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import type { LoyerNonEncaisse, TransactionNonRapprochee } from '@/types/dashboard';
import { cn } from '@/utils/cn';

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

/** Temps estimé : 1 min/loyer, 20 s/transaction, 10 s/indexation, 30 s/échéance. Retourne "~X min" ou "~X s". */
function formatTempsCourt(
  type: 'loyers' | 'echeances' | 'transactions' | 'indexations',
  count: number
): string {
  let sec = 0;
  switch (type) {
    case 'loyers':
      sec = count * 60;
      break;
    case 'transactions':
      sec = count * 20;
      break;
    case 'indexations':
      sec = count * 10;
      break;
    case 'echeances':
      sec = count * 30;
      break;
  }
  if (sec >= 60) {
    const min = Math.round(sec / 60);
    return `~${min} min`;
  }
  return sec === 0 ? '' : `~${sec} s`;
}

export interface PrioriteDuJourCardProps {
  relances: LoyerNonEncaisse[];
  transactionsNonRapprochees: TransactionNonRapprochee[];
  indexationsCount: number;
  echeancesCount: number;
  className?: string;
}

type PriorityType = 'loyers' | 'echeances' | 'transactions' | 'indexations';

export function PrioriteDuJourCard({
  relances,
  transactionsNonRapprochees,
  indexationsCount,
  echeancesCount,
  className,
}: PrioriteDuJourCardProps) {
  const priority = useMemo((): {
    type: PriorityType;
    count: number;
    label: string;
    montant?: number;
    temps: string;
    href: string;
  } | null => {
    if (relances.length > 0) {
      const montant = relances.reduce((s, r) => s + (r.montant ?? 0), 0);
      return {
        type: 'loyers',
        count: relances.length,
        label: relances.length === 1 ? 'Relancer 1 locataire' : `Relancer ${relances.length} locataires`,
        montant,
        temps: formatTempsCourt('loyers', relances.length),
        href: '/app?view=alertes&type=loyers_retard',
      };
    }
    if (echeancesCount > 0) {
      return {
        type: 'echeances',
        count: echeancesCount,
        label: echeancesCount === 1 ? '1 échéance imminente' : `${echeancesCount} échéances imminentes`,
        temps: formatTempsCourt('echeances', echeancesCount),
        href: '/app?view=alertes&type=echeances',
      };
    }
    if (transactionsNonRapprochees.length > 0) {
      const montant = transactionsNonRapprochees.reduce((s, t) => s + (t.montant ?? 0), 0);
      return {
        type: 'transactions',
        count: transactionsNonRapprochees.length,
        label: transactionsNonRapprochees.length === 1 ? '1 transaction à rapprocher' : `${transactionsNonRapprochees.length} transactions à rapprocher`,
        montant,
        temps: formatTempsCourt('transactions', transactionsNonRapprochees.length),
        href: '/app?view=alertes&type=transactions',
      };
    }
    if (indexationsCount > 0) {
      return {
        type: 'indexations',
        count: indexationsCount,
        label: indexationsCount === 1 ? '1 indexation à appliquer' : `${indexationsCount} indexations à appliquer`,
        temps: formatTempsCourt('indexations', indexationsCount),
        href: '/app?view=alertes&type=indexations',
      };
    }
    return null;
  }, [relances, transactionsNonRapprochees, indexationsCount, echeancesCount]);

  if (priority === null) {
    return (
      <div
        className={cn(
          'rounded-xl border border-slate-200 bg-emerald-50/80 px-4 py-3 w-fit max-w-full',
          className
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
          <h2 className="text-sm font-semibold text-emerald-800">✅ Tout est sous contrôle</h2>
        </div>
        <p className="text-sm text-emerald-700">Aucune action urgente aujourd&apos;hui.</p>
      </div>
    );
  }

  const hasMontant = priority.montant != null && priority.montant > 0;
  const subLine =
    priority.type === 'loyers' && hasMontant
      ? `${formatEur(priority.montant)} à récupérer • ${priority.temps}`
      : priority.type === 'transactions' && hasMontant
        ? `${formatEur(priority.montant)} à rapprocher • ${priority.temps}`
        : priority.temps
          ? priority.temps
          : null;

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 min-h-0 w-fit max-w-full',
        'bg-[#FFF7ED] border-[#FDBA74]',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-lg leading-none text-[#9A3412]" aria-hidden>🎯</span>
        <h2 className="text-sm font-semibold text-[#9A3412]">Priorité du jour</h2>
      </div>
      <p className={cn('text-sm font-medium text-[#9A3412]', !subLine && 'mb-2')}>{priority.label}</p>
      {subLine && (
        <p className="text-xs text-[#9A3412]/90 mb-2">{subLine}</p>
      )}
      <Link
        href={priority.href}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        Traiter maintenant
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
