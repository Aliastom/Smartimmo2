'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, Clock } from 'lucide-react';
import type {
  EcheancePret,
  EcheanceCharge,
  IndexationATraiter,
  BailAEcheance,
} from '@/types/dashboard';
import { cn } from '@/utils/cn';

export interface DashboardUpcomingColumnProps {
  echeancesPrets: EcheancePret[];
  echeancesCharges: EcheanceCharge[];
  indexations: IndexationATraiter[];
  bauxAEcheance: BailAEcheance[];
  currentMonth?: string;
  className?: string;
}

function UpcomingCard({
  title,
  mainLine,
  subLine,
  hasItems,
  index,
  urgencyBadge,
}: {
  title: string;
  mainLine: string;
  subLine?: string;
  hasItems: boolean;
  index: number;
  /** URGENT (< 3 j) ou PROCHE (< 7 j) */
  urgencyBadge?: 'URGENT' | 'PROCHE' | null;
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
        hasItems ? 'border-l-4 border-l-amber-500 border-slate-200' : 'border-slate-200'
      )}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 flex-wrap justify-end">
        {urgencyBadge === 'URGENT' && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700"
          >
            Urgent (&lt; 3 j)
          </motion.span>
        )}
        {urgencyBadge === 'PROCHE' && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700"
          >
            Proche (&lt; 7 j)
          </motion.span>
        )}
        {hasItems && !urgencyBadge && (
          <motion.span
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="rounded-full border border-amber-200 bg-amber-50/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700"
          >
            Prochainement
          </motion.span>
        )}
        {!hasItems && (
          <>
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500"
            >
              Aucun
            </motion.span>
            <CalendarCheck className="h-[18px] w-[18px] text-emerald-500 opacity-80" aria-hidden />
          </>
        )}
      </div>
      <p className="text-sm font-medium text-slate-600 pr-28">{title}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{mainLine}</p>
      {subLine && (
        <p className="mt-1 text-xs text-slate-500">{subLine}</p>
      )}
    </motion.div>
  );
}

export function DashboardUpcomingColumn({
  echeancesPrets,
  echeancesCharges,
  indexations,
  bauxAEcheance,
  currentMonth,
  className,
}: DashboardUpcomingColumnProps) {
  const { echeancesCount, echeancesJours, monthLabel } = useMemo(() => {
    const count = echeancesPrets.length + echeancesCharges.length;
    const all: { date: string }[] = [
      ...echeancesPrets.map((e) => ({ date: e.dateEcheance })),
      ...echeancesCharges.map((e) => ({ date: e.dateEcheance })),
    ];
    let label = '';
    if (currentMonth) {
      const [y, m] = currentMonth.split('-').map(Number);
      label = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      });
    }
    if (count === 0) return { echeancesCount: 0, echeancesJours: 0, monthLabel: label };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = all.filter((e) => {
      const d = new Date(e.date);
      d.setHours(0, 0, 0, 0);
      return d >= today;
    });
    const minDays =
      future.length > 0
        ? Math.min(
            ...future.map((e) =>
              Math.ceil(
                (new Date(e.date).getTime() - today.getTime()) /
                  (24 * 60 * 60 * 1000)
              )
            )
          )
        : 0;
    return { echeancesCount: count, echeancesJours: minDays, monthLabel: label };
  }, [echeancesPrets, echeancesCharges, currentMonth]);

  const bauxJours = useMemo(() => {
    if (bauxAEcheance.length === 0) return 0;
    return Math.min(...bauxAEcheance.map((b) => b.joursRestants));
  }, [bauxAEcheance]);

  const indexationsJours = useMemo(() => {
    if (indexations.length === 0) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = indexations.map((idx) => {
      const d = new Date(idx.dateAnniversaire);
      d.setHours(0, 0, 0, 0);
      return Math.ceil((d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    });
    const future = days.filter((j) => j >= 0);
    return future.length > 0 ? Math.min(...future) : 0;
  }, [indexations]);

  const urgencyBadgeEcheances: 'URGENT' | 'PROCHE' | null =
    echeancesCount > 0 && echeancesJours >= 0
      ? echeancesJours < 3
        ? 'URGENT'
        : echeancesJours < 7
          ? 'PROCHE'
          : null
      : null;

  return (
    <div className={cn('relative space-y-6', className)}>
      <div className="lg:sticky lg:top-20 lg:z-10 lg:bg-transparent lg:py-2 lg:-mx-1 lg:px-1 lg:border-b lg:border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900">À venir / Risque proche</h2>
        {echeancesCount > 0 && echeancesJours >= 0 && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-slate-700">
              <Clock className="h-5 w-5 text-amber-600" aria-hidden />
              <span className="text-sm font-medium">Prochaine échéance</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{echeancesJours} jour{echeancesJours !== 1 ? 's' : ''}</span>
              {urgencyBadgeEcheances === 'URGENT' && (
                <span className="rounded-full border-2 border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold uppercase text-red-700">Urgent &lt; 3 jours</span>
              )}
              {urgencyBadgeEcheances === 'PROCHE' && (
                <span className="rounded-full border-2 border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium uppercase text-amber-700">Proche &lt; 7 jours</span>
              )}
            </div>
          </div>
        )}
        <div className="h-1 w-10 bg-amber-500 rounded-full mt-2" />
      </div>
      <div className="space-y-6">
        <UpcomingCard
          index={0}
          title="Échéances du mois"
          mainLine={
            echeancesCount === 0
              ? 'Aucune échéance'
              : `${echeancesCount} échéance${echeancesCount > 1 ? 's' : ''}`
          }
          subLine={
            echeancesCount > 0 && echeancesJours >= 0
              ? `Prochaine échéance dans ${echeancesJours} jour${echeancesJours !== 1 ? 's' : ''}`
              : monthLabel || undefined
          }
          hasItems={echeancesCount > 0}
          urgencyBadge={urgencyBadgeEcheances}
        />
        <UpcomingCard
          index={1}
          title="Indexations à appliquer"
          mainLine={
            indexations.length === 0
              ? 'Aucune'
              : `${indexations.length} indexation${indexations.length > 1 ? 's' : ''}`
          }
          subLine={
            indexations.length > 0 && indexationsJours >= 0
              ? `Prochaine dans ${indexationsJours} jour${indexationsJours !== 1 ? 's' : ''}`
              : undefined
          }
          hasItems={indexations.length > 0}
          urgencyBadge={indexations.length > 0 && indexationsJours >= 0 ? (indexationsJours < 3 ? 'URGENT' : indexationsJours < 7 ? 'PROCHE' : null) : undefined}
        />
        <UpcomingCard
          index={2}
          title="Baux proches expiration"
          mainLine={
            bauxAEcheance.length === 0
              ? 'Aucun'
              : `${bauxAEcheance.length} bail${bauxAEcheance.length > 1 ? 'x' : ''}`
          }
          subLine={
            bauxAEcheance.length > 0 && bauxJours > 0
              ? `Prochaine échéance dans ${bauxJours} j`
              : undefined
          }
          hasItems={bauxAEcheance.length > 0}
        />
      </div>
    </div>
  );
}
