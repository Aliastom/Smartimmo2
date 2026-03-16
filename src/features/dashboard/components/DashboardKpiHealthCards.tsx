'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Euro, TrendingUp, TrendingDown, Activity, Home, FileCheck2 } from 'lucide-react';
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
  /** Nombre de biens (pour Revenu moyen par bien) */
  propertyCount?: number;
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPct(n: number): string {
  return `${n.toFixed(1)} %`;
}

type KpiStatus = 'ok' | 'attention' | 'alert';

/** Taux d'encaissement cohérent partout : loyers encaissés / loyers attendus * 100, max 100 % */
function getTauxEncaissementDisplay(kpis: MonthlyKPIs): number {
  const la = kpis.loyersAttendus ?? 0;
  const le = kpis.sommesEncaissesRapprochees ?? 0;
  return la > 0 ? Math.min(100, (le / la) * 100) : 0;
}

function getKpiStatus(
  id: string,
  kpis: MonthlyKPIs
): KpiStatus {
  const tauxDisplay = getTauxEncaissementDisplay(kpis);
  switch (id) {
    case 'cashflow':
      return kpis.cashflow < 0 ? 'alert' : kpis.deltaCashflow < 0 ? 'attention' : 'ok';
    case 'taux':
      return tauxDisplay >= 90 ? 'ok' : tauxDisplay >= 70 ? 'attention' : 'alert';
    case 'depenses':
    case 'sommes':
    case 'baux':
    case 'documents':
    case 'loyersAttendus':
    case 'vacanceLocative':
    case 'rendementBrut':
    case 'revenuMoyenBien':
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
  loyersAttendus: Euro,
  vacanceLocative: Home,
  rendementBrut: TrendingUp,
  revenuMoyenBien: Euro,
};

/** Couleurs par type : Cashflow → vert, Dépenses → rouge, Encaissement → bleu, Vacance → orange */
const CARD_TYPE_STYLES: Record<string, { iconBg: string; iconColor: string; borderHover?: string }> = {
  cashflow: { iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', borderHover: 'hover:border-emerald-200' },
  depenses: { iconBg: 'bg-red-100', iconColor: 'text-red-600', borderHover: 'hover:border-red-200' },
  sommes: { iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderHover: 'hover:border-blue-200' },
  taux: { iconBg: 'bg-slate-100', iconColor: 'text-slate-600', borderHover: 'hover:border-slate-300' },
  loyersAttendus: { iconBg: 'bg-blue-100', iconColor: 'text-blue-600', borderHover: 'hover:border-blue-200' },
  vacanceLocative: { iconBg: 'bg-amber-100', iconColor: 'text-amber-600', borderHover: 'hover:border-amber-200' },
  baux: { iconBg: 'bg-slate-100', iconColor: 'text-slate-600', borderHover: 'hover:border-slate-300' },
  documents: { iconBg: 'bg-slate-100', iconColor: 'text-slate-600', borderHover: 'hover:border-slate-300' },
  rendementBrut: { iconBg: 'bg-slate-100', iconColor: 'text-slate-600', borderHover: 'hover:border-slate-300' },
  revenuMoyenBien: { iconBg: 'bg-slate-100', iconColor: 'text-slate-600', borderHover: 'hover:border-slate-300' },
};

export function DashboardKpiHealthCards({
  kpis,
  sparklineCashflow,
  sparklineEncaissements,
  sparklineDepenses,
  sparklineTaux,
  focusLoyer = false,
  propertyCount = 0,
  className,
}: DashboardKpiHealthCardsProps) {
  const tauxDisplay = getTauxEncaissementDisplay(kpis);
  const revenuMoyenBien = propertyCount > 0 ? kpis.loyersAttendus / propertyCount : 0;

  const cards = [
    { id: 'cashflow', title: 'Cashflow du mois', value: kpis.cashflow, format: formatEur, delta: kpis.deltaCashflow, sparkline: sparklineCashflow, tooltip: 'Loyers encaissés – dépenses du mois' },
    { id: 'sommes', title: focusLoyer ? 'Loyers encaissés' : 'Sommes encaissées', value: kpis.sommesEncaissesRapprochees, format: formatEur, delta: kpis.deltaSommesEncaisses, sparkline: sparklineEncaissements, tooltip: focusLoyer ? 'Loyers encaissés et rapprochés' : 'Sommes encaissées et rapprochées' },
    { id: 'depenses', title: focusLoyer ? 'Frais de gestion' : 'Dépenses réalisées', value: kpis.depensesRealiseesRapprochees, format: formatEur, delta: kpis.deltaDepensesRealisees, sparkline: sparklineDepenses, tooltip: focusLoyer ? 'Frais de gestion rapprochés' : 'Dépenses réalisées du mois' },
    { id: 'taux', title: "Taux d'encaissement", value: tauxDisplay, format: (n: number) => formatPct(n), delta: kpis.deltaTauxEncaissement, sparkline: sparklineTaux, tooltip: 'Loyers encaissés / loyers attendus' },
    { id: 'loyersAttendus', title: 'Loyers attendus du mois', value: kpis.loyersAttendus, format: formatEur, delta: 0, sparkline: undefined, tooltip: 'Somme des loyers contractuels attendus pour le mois' },
    { id: 'baux', title: 'Baux actifs', value: kpis.bauxActifs, format: (n: number) => String(n), delta: 0, sparkline: undefined, tooltip: 'Nombre de baux actifs au mois' },
    { id: 'vacanceLocative', title: 'Vacance locative', value: 0, format: (n: number) => `${n} logement${n !== 1 ? 's' : ''} vacant${n !== 1 ? 's' : ''}`, delta: 0, sparkline: undefined, tooltip: 'Logements vacants / total logements' },
    { id: 'rendementBrut', title: 'Rendement brut portefeuille', value: 0, format: (n: number) => `${n.toFixed(1)} %`, delta: 0, sparkline: undefined, tooltip: 'Rendement brut du portefeuille (à venir)' },
    { id: 'revenuMoyenBien', title: 'Revenu moyen par bien', value: revenuMoyenBien, format: formatEur, delta: 0, sparkline: undefined, tooltip: 'Loyers attendus / nombre de biens' },
  ];

  return (
    <div
      className={cn('grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 items-stretch', className)}
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
  tooltip?: string;
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
  const typeStyle = CARD_TYPE_STYLES[card.id] ?? { iconBg: 'bg-slate-100', iconColor: 'text-slate-500', borderHover: 'hover:border-slate-300' };
  const isCurrency = card.id !== 'taux' && card.id !== 'baux' && card.id !== 'vacanceLocative' && card.id !== 'rendementBrut' && card.id !== 'revenuMoyenBien';
  const countUp = useCountUpCurrency(
    Math.abs(Math.round(card.value)),
    isCurrency && card.id !== 'baux' && card.id !== 'vacanceLocative' && card.id !== 'rendementBrut' && card.id !== 'revenuMoyenBien',
    500
  );
  const formattedValue =
    card.id === 'baux'
      ? String(card.value)
      : card.id === 'vacanceLocative' || card.id === 'rendementBrut' || card.id === 'revenuMoyenBien'
        ? card.id === 'revenuMoyenBien'
          ? formatEur(card.value)
          : card.format(card.value)
        : card.id === 'taux'
          ? card.format(card.value)
          : isCurrency
            ? (card.value >= 0 ? '' : '-') + formatEur(card.value)
            : card.format(card.value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 shadow transition-all duration-200 ease-out hover:shadow-lg min-h-[150px] w-full flex flex-col',
        typeStyle.borderHover
      )}
    >
      <div className="flex items-start justify-between gap-2 flex-1">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-700" title={card.tooltip}>{card.title}</p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="mt-1 text-xl font-semibold text-gray-900 tabular-nums"
          >
            {formattedValue}
          </motion.p>
          {card.delta !== 0 && card.id !== 'baux' && card.id !== 'vacanceLocative' && card.id !== 'rendementBrut' && card.id !== 'revenuMoyenBien' && (
            <p
              className={cn(
                'mt-0.5 text-xs inline-flex items-center gap-1',
                card.delta > 0 ? 'text-emerald-600' : card.delta < 0 ? 'text-red-600' : 'text-slate-500'
              )}
            >
              {card.delta > 0 ? <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden /> : card.delta < 0 ? <TrendingDown className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              {card.delta > 0 ? '+' : ''}
              {card.id === 'taux' ? `${card.delta.toFixed(1)} %` : formatEur(card.delta)} vs mois préc.
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('flex-shrink-0 rounded-xl p-3', typeStyle.iconBg, typeStyle.iconColor)}>
            <Icon className="h-6 w-6" aria-hidden />
          </div>
        )}
      </div>
      {card.id === 'taux' && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              card.value >= 80 ? 'bg-emerald-500' : card.value >= 50 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${Math.min(100, Math.max(0, card.value))}%` }}
          />
        </div>
      )}
      {card.sparkline && card.sparkline.length >= 2 && card.id !== 'taux' && (
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
