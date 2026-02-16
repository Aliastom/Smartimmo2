'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { MonthlyKPIs } from '@/types/dashboard';
import type { LoyerNonEncaisse, TransactionNonRapprochee } from '@/types/dashboard';
import { cn } from '@/utils/cn';

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export interface DashboardUrgentColumnProps {
  kpis: MonthlyKPIs;
  relances: LoyerNonEncaisse[];
  transactionsNonRapprochees: TransactionNonRapprochee[];
  currentMonth: string;
  className?: string;
}

function UrgentCard({
  title,
  mainValue,
  mainBadge,
  subValue,
  subBadge,
  hasIssue,
  index,
}: {
  title: string;
  mainValue: string;
  mainBadge: string;
  subValue: string;
  subBadge: string;
  hasIssue: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut', delay: index * 0.05 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      className={cn(
        'relative rounded-xl border bg-white p-6 shadow-sm transition-all duration-200 ease-out',
        'hover:shadow-lg hover:border-slate-300',
        hasIssue ? 'border-l-4 border-l-red-500 border-slate-200' : 'border-slate-200'
      )}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {hasIssue ? (
          <>
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700 transition-colors duration-200 hover:bg-red-100/80"
            >
              À traiter
            </motion.span>
            <AlertCircle
              className="h-[18px] w-[18px] text-red-500 opacity-80"
              aria-hidden
            />
          </>
        ) : (
          <>
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 transition-colors duration-200 hover:bg-emerald-100/80"
            >
              OK
            </motion.span>
            <CheckCircle2
              className="h-[18px] w-[18px] text-emerald-500 opacity-80"
              aria-hidden
            />
          </>
        )}
      </div>
      <p className="text-sm font-medium text-slate-600 pr-28">{title}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{mainValue}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <span>{mainBadge}</span>
        <span className="text-slate-300">•</span>
        <span>{subValue}</span>
        <span className="text-slate-300">•</span>
        <span>{subBadge}</span>
      </div>
    </motion.div>
  );
}

export function DashboardUrgentColumn({
  kpis,
  relances,
  transactionsNonRapprochees,
  currentMonth,
  className,
}: DashboardUrgentColumnProps) {
  const manqueMoisCourant = Math.max(
    0,
    kpis.loyersAttendus - kpis.sommesEncaissesRapprochees
  );
  const manqueCumul = relances.reduce((s, r) => s + r.montant, 0);
  const hasManque = manqueMoisCourant > 0 || manqueCumul > 0;

  const relancesMoisCourant = relances.filter(
    (r) => r.accountingMonth === currentMonth
  );
  const loyersImpayesMoisCount = relancesMoisCourant.length;
  const loyersImpayesMoisAmount = relancesMoisCourant.reduce(
    (s, r) => s + r.montant,
    0
  );
  const loyersImpayesCumul = relances.reduce((s, r) => s + r.montant, 0);
  const hasLoyersImpayes =
    loyersImpayesMoisCount > 0 || loyersImpayesCumul > 0;

  const txMoisCourant = transactionsNonRapprochees.filter(
    (t) => t.accountingMonth === currentMonth
  );
  const txMoisCount = txMoisCourant.length;
  const txMoisAmount = txMoisCourant.reduce((s, t) => s + t.montant, 0);
  const txCumulCount = transactionsNonRapprochees.length;
  const txCumulAmount = transactionsNonRapprochees.reduce(
    (s, t) => s + t.montant,
    0
  );
  const hasTxNonRapprochees = txCumulCount > 0;

  return (
    <div className={cn('relative space-y-6', className)}>
      <div className="lg:sticky lg:top-20 lg:z-10 lg:bg-transparent lg:py-2 lg:-mx-1 lg:px-1 lg:border-b lg:border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900">Hors norme / À traiter</h2>
        <div className="h-1 w-10 bg-red-500 rounded-full mt-2" />
      </div>
      <div className="space-y-6">
        <UrgentCard
          index={0}
          title="Manque perçu"
          mainValue={formatEur(manqueMoisCourant)}
          mainBadge="Mois en cours"
          subValue={formatEur(manqueCumul)}
          subBadge="Cumul"
          hasIssue={hasManque}
        />
        <UrgentCard
          index={1}
          title="Loyers impayés"
          mainValue={
            loyersImpayesMoisCount > 0
              ? `${loyersImpayesMoisCount} loyer${loyersImpayesMoisCount > 1 ? 's' : ''} · ${formatEur(loyersImpayesMoisAmount)}`
              : '0'
          }
          mainBadge="Mois en cours"
          subValue={formatEur(loyersImpayesCumul)}
          subBadge="Cumul"
          hasIssue={hasLoyersImpayes}
        />
        <UrgentCard
          index={2}
          title="Transactions non rapprochées"
          mainValue={
            txMoisCount > 0
              ? `${txMoisCount} transaction${txMoisCount > 1 ? 's' : ''} · ${formatEur(txMoisAmount)}`
              : '0'
          }
          mainBadge="Mois en cours"
          subValue={`${txCumulCount} au total · ${formatEur(txCumulAmount)}`}
          subBadge="Cumul"
          hasIssue={hasTxNonRapprochees}
        />
      </div>
    </div>
  );
}
