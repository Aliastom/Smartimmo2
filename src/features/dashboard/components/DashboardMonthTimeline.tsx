'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { Percent, Euro, AlertTriangle, Calendar } from 'lucide-react';
import type {
  LoyerNonEncaisse,
  TransactionNonRapprochee,
  IndexationATraiter,
  EcheancePret,
  EcheanceCharge,
  BailAEcheance,
} from '@/types/dashboard';
import { cn } from '@/utils/cn';

export interface TimelineEvent {
  date: string;
  label: string;
  propertyName: string;
  status: 'En retard' | 'À venir' | 'À rapprocher' | 'À appliquer';
  type: 'loyer' | 'transaction' | 'indexation' | 'pret' | 'charge' | 'bail';
  amount?: number;
}

export interface DashboardMonthTimelineProps {
  relances: LoyerNonEncaisse[];
  transactionsNonRapprochees: TransactionNonRapprochee[];
  indexations: IndexationATraiter[];
  echeancesPrets: EcheancePret[];
  echeancesCharges: EcheanceCharge[];
  bauxAEcheance: BailAEcheance[];
  currentMonth: string;
  className?: string;
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

const STATUS_STYLE: Record<string, string> = {
  'En retard': 'bg-red-100 text-red-700 border-red-200',
  'À venir': 'bg-blue-100 text-blue-700 border-blue-200',
  'À rapprocher': 'bg-amber-100 text-amber-700 border-amber-200',
  'À appliquer': 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const TYPE_ICON: Record<TimelineEvent['type'], React.ElementType> = {
  loyer: AlertTriangle,
  transaction: Euro,
  indexation: Percent,
  pret: Calendar,
  charge: Calendar,
  bail: Calendar,
};

const TYPE_FILTER_LABEL: Record<TimelineEvent['type'] | 'all', string> = {
  all: 'Tous',
  loyer: 'Relances',
  transaction: 'Transactions',
  indexation: 'Indexations',
  pret: 'Prêts',
  charge: 'Charges',
  bail: 'Baux',
};

export function DashboardMonthTimeline({
  relances,
  transactionsNonRapprochees,
  indexations,
  echeancesPrets,
  echeancesCharges,
  bauxAEcheance,
  currentMonth,
  className,
}: DashboardMonthTimelineProps) {
  const [typeFilter, setTypeFilter] = useState<TimelineEvent['type'] | 'all'>('all');

  const [firstDay] = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    return [first.toISOString().slice(0, 10)];
  }, [currentMonth]);

  const events = useMemo((): TimelineEvent[] => {
    const out: TimelineEvent[] = [];
    relances.forEach((r) => {
      const date = r.dateEcheance || (r.accountingMonth ? `${r.accountingMonth}-01` : firstDay);
      out.push({
        date,
        label: 'Relance locataire',
        propertyName: r.propertyName,
        status: r.statut === 'en_retard' ? 'En retard' : 'À venir',
        type: 'loyer',
        amount: r.montant,
      });
    });
    transactionsNonRapprochees.forEach((t) => {
      out.push({
        date: t.date?.slice(0, 10) || firstDay,
        label: 'Transaction à rapprocher',
        propertyName: t.propertyName,
        status: 'À rapprocher',
        type: 'transaction',
        amount: t.montant,
      });
    });
    indexations.forEach((i) => {
      out.push({
        date: i.dateAnniversaire?.slice(0, 10) || firstDay,
        label: 'Indexation',
        propertyName: i.propertyName,
        status: 'À appliquer',
        type: 'indexation',
      });
    });
    echeancesPrets.forEach((e) => {
      out.push({
        date: e.dateEcheance?.slice(0, 10) || firstDay,
        label: 'Échéance prêt',
        propertyName: e.propertyName,
        status: 'À venir',
        type: 'pret',
        amount: e.montantTotal,
      });
    });
    echeancesCharges.forEach((e) => {
      out.push({
        date: e.dateEcheance?.slice(0, 10) || firstDay,
        label: e.label || 'Échéance charge',
        propertyName: e.propertyName || '—',
        status: 'À venir',
        type: 'charge',
        amount: e.montant,
      });
    });
    bauxAEcheance.forEach((b) => {
      out.push({
        date: b.dateFinBail?.slice(0, 10) || firstDay,
        label: 'Échéance bail',
        propertyName: b.propertyName,
        status: 'À venir',
        type: 'bail',
      });
    });
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [relances, transactionsNonRapprochees, indexations, echeancesPrets, echeancesCharges, bauxAEcheance, firstDay]);

  const filteredEvents = useMemo(
    () => (typeFilter === 'all' ? events : events.filter((e) => e.type === typeFilter)),
    [events, typeFilter]
  );

  const typesPresent = useMemo(() => {
    const s = new Set(events.map((e) => e.type));
    return ['all', ...Array.from(s)];
  }, [events]);

  if (events.length === 0) {
    return (
      <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
        <CardContent className="py-6">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Timeline du mois</h3>
          <p className="text-sm text-slate-500">Aucun événement à afficher pour ce mois.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('border-slate-200 bg-white shadow-sm', className)}>
      <CardContent className="py-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-slate-800">Timeline du mois</h3>
          <div className="flex flex-wrap gap-1">
            {typesPresent.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t as TimelineEvent['type'] | 'all')}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  typeFilter === t
                    ? 'border-slate-400 bg-slate-100 text-slate-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                {TYPE_FILTER_LABEL[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                <th className="pb-2 pr-2 w-8" aria-hidden />
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Événement</th>
                <th className="pb-2 pr-4">Bien</th>
                <th className="pb-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((evt, i) => {
                const Icon = TYPE_ICON[evt.type];
                return (
                  <Tooltip key={i} delayDuration={200}>
                    <TooltipTrigger asChild>
                  <tr
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors cursor-default"
                  >
                    <td className="py-2.5 pr-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-slate-600">
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-slate-700 whitespace-nowrap">
                      {formatDateShort(evt.date)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-slate-900">{evt.label}</span>
                      {evt.amount != null && evt.amount > 0 && (
                        <span className="ml-1 text-slate-500">({formatEur(evt.amount)})</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-600">{evt.propertyName}</td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                          STATUS_STYLE[evt.status] || 'bg-slate-100 text-slate-600'
                        )}
                      >
                        {evt.status}
                      </span>
                    </td>
                  </tr>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="grid gap-1 text-xs">
                        <div className="font-semibold">{evt.label}</div>
                        <div>Bien : {evt.propertyName}</div>
                        {evt.amount != null && evt.amount > 0 && <div>Montant : {formatEur(evt.amount)}</div>}
                        <div>Statut : {evt.status}</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
