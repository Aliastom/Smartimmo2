'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import type { RentalPropertyInput } from '@/types/fiscal';
import { StatCard } from '@/components/ui/StatCard';

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function centsToEuros(c: number) {
  return c / 100;
}

export function PropertyFiscalKpiBar({
  bien,
  resultatFiscalApresAmort,
  loading,
}: {
  bien: RentalPropertyInput | null;
  /** Résultat fiscal LMNP (après règle des amortissements déductibles) */
  resultatFiscalApresAmort: number | null;
  loading: boolean;
}) {
  const [chargesOpen, setChargesOpen] = useState(false);

  const p = bien?.breakdown?.lmnpDebug?.perimetreDiagnostic;
  const ob = p?.outsideTransactionsBreakdown;

  const chargesTx = p ? p.chargesFromTransactionsCents / 100 : null;
  const chargesHorsTx = p ? p.chargesOutsideTransactionsCents / 100 : null;
  const chargesTot = p ? p.chargesTotalSimulatorCents / 100 : null;
  const amort = p?.montantAmortissementsComptablesHorsTransactions ?? null;
  const recettes = bien ? bien.loyers + (bien.autresRevenus || 0) : null;

  const loanIx = ob ? centsToEuros(ob.loanInterestsCents) : null;
  const loanIns = ob ? centsToEuros(ob.loanInsuranceCents) : null;
  const forfait = ob ? centsToEuros(ob.forfaitOrCalculatedChargesCents) : null;
  const otherHors = ob ? centsToEuros(ob.otherCents) : null;

  const mainCards = [
    {
      id: 'rec',
      title: 'Recettes fiscales retenues',
      value: recettes != null ? fmt(recettes) : '—',
      color: 'green' as const,
      iconName: 'TrendingUp' as const,
    },
    {
      id: 'ch_ded',
      title: 'Charges déductibles',
      value: chargesTot != null ? fmt(chargesTot) : '—',
      color: 'red' as const,
      iconName: 'TrendingDown' as const,
    },
    {
      id: 'amort',
      title: 'Amortissements comptabilisés',
      value: amort != null ? fmt(amort) : '—',
      color: 'indigo' as const,
      iconName: 'CreditCard' as const,
    },
    {
      id: 'res',
      title: 'Résultat fiscal LMNP',
      value: resultatFiscalApresAmort != null ? fmt(resultatFiscalApresAmort) : '—',
      color:
        resultatFiscalApresAmort != null && resultatFiscalApresAmort >= 0
          ? ('green' as const)
          : ('red' as const),
      iconName: 'CheckCircle' as const,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 text-sm text-slate-600" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" aria-hidden />
          Synchronisation du calcul fiscal…
        </p>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {mainCards.map((c) => (
            <div key={c.id} className="h-24 animate-pulse rounded-xl border bg-white p-4" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {mainCards.map((c) => (
          <StatCard
            key={c.id}
            title={c.title}
            value={c.value}
            iconName={c.iconName}
            color={c.color}
          />
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white/90">
        <button
          type="button"
          onClick={() => setChargesOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50/80"
        >
          <span>Détail des charges</span>
          {chargesOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
          )}
        </button>
        {chargesOpen ? (
          <div className="border-t border-slate-100 px-3 py-3 text-[11px] text-slate-700 space-y-2">
            <div className="flex justify-between gap-2">
              <span>Charges issues des transactions</span>
              <span className="tabular-nums font-medium">
                {chargesTx != null ? fmt(chargesTx) : '—'}
              </span>
            </div>
            <p className="font-medium text-slate-900 pt-1">Charges hors transactions</p>
            <ul className="ml-2 space-y-1 border-l-2 border-slate-200 pl-3">
              <li className="flex justify-between gap-2">
                <span>Intérêts d’emprunt</span>
                <span className="tabular-nums">{loanIx != null ? fmt(loanIx) : '—'}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Assurance emprunteur</span>
                <span className="tabular-nums">{loanIns != null ? fmt(loanIns) : '—'}</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Forfait / charges calculées</span>
                <span className="tabular-nums">{forfait != null ? fmt(forfait) : '—'}</span>
              </li>
              {otherHors != null && Math.abs(otherHors) > 0.01 ? (
                <li className="flex justify-between gap-2 text-slate-600">
                  <span>Autres (résidu / méthode)</span>
                  <span className="tabular-nums">{fmt(otherHors)}</span>
                </li>
              ) : null}
              <li className="flex justify-between gap-2 pt-1 font-medium text-slate-900">
                <span>Sous-total hors transactions</span>
                <span className="tabular-nums">{chargesHorsTx != null ? fmt(chargesHorsTx) : '—'}</span>
              </li>
            </ul>
            <div className="flex justify-between gap-2 border-t border-slate-200 pt-2 font-semibold text-slate-900">
              <span>Total charges déductibles</span>
              <span className="tabular-nums">{chargesTot != null ? fmt(chargesTot) : '—'}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
