'use client';

import React from 'react';
import { ShieldAlert, ShieldCheck, ShieldHalf } from 'lucide-react';
import { formatCurrencyEUR } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { EmergencyFundResult } from '@/features/patrimoine/services/emergencyFundService';

export interface PatrimoineEmergencyFundCardProps {
  fund: EmergencyFundResult;
  className?: string;
}

function statusBadge(fund: EmergencyFundResult): { label: string; className: string; Icon: typeof ShieldCheck } {
  switch (fund.status) {
    case 'CRITIQUE':
      return {
        label: 'Critique',
        className: 'bg-rose-100 text-rose-900 ring-rose-200/80',
        Icon: ShieldAlert,
      };
    case 'A_RENFORCER':
      return {
        label: 'À renforcer',
        className: 'bg-amber-100 text-amber-950 ring-amber-200/80',
        Icon: ShieldHalf,
      };
    case 'CONFORTABLE':
      return {
        label: 'Confortable',
        className: 'bg-emerald-100 text-emerald-900 ring-emerald-200/80',
        Icon: ShieldCheck,
      };
    default:
      return {
        label: 'Indisponible',
        className: 'bg-slate-100 text-slate-700 ring-slate-200/80',
        Icon: ShieldHalf,
      };
  }
}

export function PatrimoineEmergencyFundCard({ fund, className }: PatrimoineEmergencyFundCardProps) {
  const badge = statusBadge(fund);
  const Icon = badge.Icon;

  return (
    <section
      className={cn(
        'rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm sm:p-3',
        className
      )}
      aria-label="Épargne de sécurité"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-slate-900 sm:text-sm">Épargne de sécurité</h2>
          <p className="mt-0.5 text-[10px] text-slate-500 sm:text-[11px]">
            Cible 3–6 mois de revenu net (aligné sur le revenu annuel affiché plus haut)
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 sm:text-[11px]',
            badge.className
          )}
        >
          <Icon className="h-3 w-3 shrink-0" aria-hidden />
          {badge.label}
        </span>
      </div>

      {fund.status === 'CRITIQUE' && (
        <div
          className="mt-2 rounded-lg border border-rose-200/80 bg-rose-50/80 px-2.5 py-2 text-[11px] leading-snug text-rose-950 sm:text-xs"
          role="status"
        >
          Votre épargne de sécurité est insuffisante : priorité au renforcement avant investissement.
        </div>
      )}

      <dl className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
          <dt className="text-[9px] font-medium uppercase tracking-wide text-slate-500 sm:text-[10px]">Cash disponible</dt>
          <dd className="mt-0.5 text-xs font-semibold tabular-nums text-slate-900 sm:text-sm">
            {formatCurrencyEUR(fund.currentCash)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
          <dt className="text-[9px] font-medium uppercase tracking-wide text-slate-500 sm:text-[10px]">Couverture</dt>
          <dd className="mt-0.5 text-xs font-semibold tabular-nums text-slate-900 sm:text-sm">
            {fund.coverageMonths != null ? `${fund.coverageMonths} mois` : '—'}
          </dd>
        </div>
        <div className="col-span-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5 sm:col-span-1">
          <dt className="text-[9px] font-medium uppercase tracking-wide text-slate-500 sm:text-[10px]">Revenu net / mois</dt>
          <dd className="mt-0.5 text-xs font-semibold tabular-nums text-slate-900 sm:text-sm">
            {fund.monthlyNetIncome != null ? formatCurrencyEUR(fund.monthlyNetIncome) : '—'}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
          <dt className="text-[9px] font-medium uppercase tracking-wide text-slate-500 sm:text-[10px]">Seuil min. (3 mois)</dt>
          <dd className="mt-0.5 text-xs font-semibold tabular-nums text-slate-900 sm:text-sm">
            {fund.emergencyFundMin != null ? formatCurrencyEUR(fund.emergencyFundMin) : '—'}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
          <dt className="text-[9px] font-medium uppercase tracking-wide text-slate-500 sm:text-[10px]">Objectif confort (6 mois)</dt>
          <dd className="mt-0.5 text-xs font-semibold tabular-nums text-slate-900 sm:text-sm">
            {fund.emergencyFundTarget != null ? formatCurrencyEUR(fund.emergencyFundTarget) : '—'}
          </dd>
        </div>
      </dl>

      {fund.status === 'INDISPONIBLE' && (
        <p className="mt-2 text-[10px] text-slate-500 sm:text-[11px]">
          Indique un revenu net annuel (simulation fiscale ou hypothèses) pour estimer la couverture en mois.
        </p>
      )}
    </section>
  );
}
