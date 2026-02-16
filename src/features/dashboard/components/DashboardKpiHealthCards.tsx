'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Euro, TrendingUp, Activity, Home, FileCheck2 } from 'lucide-react';
import { MiniSparkline } from './MiniSparkline';
import type { MonthlyKPIs } from '@/types/dashboard';
import { cn } from '@/utils/cn';

export interface DashboardKpiHealthCardsProps {
  kpis: MonthlyKPIs;
  sparklineCashflow?: number[];
  sparklineEncaissements?: number[];
  sparklineDepenses?: number[];
  sparklineTaux?: number[];
  focusLoyer?: boolean;
  className?: string;
}

function useCountUpCurrency(end: number, enabled: boolean, durationMs = 600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!enabled) {
      setValue(end);
      return;
    }
    let start: number;
    const step = (t: number) => {
      const progress = Math.min((t - start) / durationMs, 1);
      setValue(Math.round(progress * end));
      if (progress < 1) requestAnimationFrame(step);
    };
    start = performance.now();
    requestAnimationFrame(step);
  }, [end, enabled, durationMs]);
  return value;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function formatPct(n: number): string {
  return `${n.toFixed(1)} %`;
}

type KpiStatus = 'ok' | 'attention' | 'alert';

function getKpiStatus(
  id: string,
  kpis: MonthlyKPIs
): KpiStatus {
  switch (id) {
    case 'cashflow':
      return kpis.cashflow < 0 ? 'alert' : kpis.deltaCashflow < 0 ? 'attention' : 'ok';
    case 'taux':
      return kpis.tauxEncaissement >= 90 ? 'ok' : kpis.tauxEncaissement >= 70 ? 'attention' : 'alert';
    case 'depenses':
    case 'sommes':
    case 'baux':
    case 'documents':
    default:
      return 'ok';
  }
}

const CARD_ICONS: Record<string, React.ElementType> = {
  sommes: Euro,
  depenses: TrendingUp,
  cashflow: Activity,
  taux: TrendingUp,
  baux: Home,
  documents: FileCheck2,
};

export function DashboardKpiHealthCards({
  kpis,
  sparklineCashflow,
  sparklineEncaissements,
  sparklineDepenses,
  sparklineTaux,
  focusLoyer = false,
  className,
}: DashboardKpiHealthCardsProps) {
  const cards = [
    {
      id: 'cashflow',
      title: 'Cashflow du mois',
      value: kpis.cashflow,
      format: formatEur,
      delta: kpis.deltaCashflow,
      sparkline: sparklineCashflow,
    },
    {
      id: 'taux',
      title: "Taux d'encaissement",
      value: kpis.tauxEncaissement,
      format: (n: number) => formatPct(n),
      delta: kpis.deltaTauxEncaissement,
      sparkline: sparklineTaux,
    },
    {
      id: 'depenses',
      title: focusLoyer ? 'Frais de gestion' : 'Dépenses réalisées',
      value: kpis.depensesRealiseesRapprochees,
      format: formatEur,
      delta: kpis.deltaDepensesRealisees,
      sparkline: sparklineDepenses,
    },
    {
      id: 'sommes',
      title: focusLoyer ? 'Loyers encaissés' : 'Sommes encaissées',
      value: kpis.sommesEncaissesRapprochees,
      format: formatEur,
      delta: kpis.deltaSommesEncaisses,
      sparkline: sparklineEncaissements,
    },
    {
      id: 'baux',
      title: 'Baux actifs',
      value: kpis.bauxActifs,
      format: (n: number) => String(n),
      delta: 0,
      sparkline: undefined,
    },
  ];

  return (
    <div
      className={cn('grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5', className)}
      style={{ perspective: '1000px' }}
    >
      {cards.map((card, index) => (
        <KpiCard
          key={card.id}
          card={card}
          index={index}
          focusLoyer={focusLoyer}
          kpis={kpis}
        />
      ))}
    </div>
  );
}

interface KpiCardDef {
  id: string;
  title: string;
  value: number;
  format: (n: number) => string;
  delta: number;
  sparkline?: number[];
}

function KpiCard({
  card,
  index,
  kpis,
}: {
  card: KpiCardDef;
  index: number;
  focusLoyer: boolean;
  kpis: MonthlyKPIs;
}) {
  const status = getKpiStatus(card.id, kpis);
  const Icon = CARD_ICONS[card.id];
  const isCurrency = card.id !== 'taux' && card.id !== 'baux';
  const countUp = useCountUpCurrency(
    Math.abs(Math.round(card.value)),
    isCurrency && card.id !== 'baux',
    500
  );
  const formattedValue =
    card.id === 'baux'
      ? String(card.value)
      : card.id === 'taux'
        ? card.format(card.value)
        : isCurrency
          ? (card.value >= 0 ? '' : '-') + formatEur(countUp)
          : card.format(card.value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 ease-out hover:shadow-lg hover:border-slate-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-700">{card.title}</p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="mt-1 text-xl font-semibold text-gray-900 tabular-nums"
          >
            {formattedValue}
          </motion.p>
          {card.delta !== 0 && card.id !== 'baux' && (
            <p
              className={cn(
                'mt-0.5 text-xs',
                card.delta > 0 ? 'text-emerald-600' : card.delta < 0 ? 'text-red-600' : 'text-slate-500'
              )}
            >
              {card.delta > 0 ? '+' : ''}
              {card.id === 'taux' ? `${card.delta.toFixed(1)} %` : formatEur(card.delta)} vs mois préc.
            </p>
          )}
        </div>
        {Icon && (
          <div className="flex-shrink-0 rounded-lg p-2 text-slate-400">
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        )}
      </div>
      {card.sparkline && card.sparkline.length >= 2 && (
        <div className="mt-3 flex items-center justify-end">
          <MiniSparkline
            data={card.sparkline}
            height={20}
            color={card.delta < 0 ? '#ef4444' : '#64748b'}
            duration={0.4}
          />
        </div>
      )}
    </motion.div>
  );
}
