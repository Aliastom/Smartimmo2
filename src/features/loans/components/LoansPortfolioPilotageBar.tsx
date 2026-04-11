'use client';

import React from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';

export type LoansPortfolioPilotageFilterKey = 'negative_cf' | 'heavy_payment' | 'high_rate';

export function propertyLoansTabHref(propertyId: string): string {
  return `/app?view=property&propertyId=${encodeURIComponent(propertyId)}&tab=loans`;
}

export interface LoansPortfolioPilotageBarProps {
  negativeCashflowPropertyCount: number;
  heavyPaymentLoanCount: number;
  highRateLoanCount: number;
  activeFilter: LoansPortfolioPilotageFilterKey | null;
  /** Applique ce filtre sur le tableau (sélection exclusive) */
  onApplyFilter: (key: LoansPortfolioPilotageFilterKey) => void;
  /** Retire uniquement le filtre pilotage */
  onResetPilotage: () => void;
  isLoading?: boolean;
  /** Biens en cashflow négatif (noms + ids) — affichage de liens « Voir le bien » quand le filtre correspondant est actif */
  negativeCashflowPropertyLinks?: Array<{ id: string; name: string }>;
  /** Masque le bloc titre / intro (sous la carte « Actions à traiter »). */
  compact?: boolean;
}

const chipBase =
  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1';

export function LoansPortfolioPilotageBar({
  negativeCashflowPropertyCount,
  heavyPaymentLoanCount,
  highRateLoanCount,
  activeFilter,
  onApplyFilter,
  onResetPilotage,
  isLoading = false,
  negativeCashflowPropertyLinks = [],
  compact = false,
}: LoansPortfolioPilotageBarProps) {
  if (isLoading) {
    return (
      <div className="flex flex-wrap items-center gap-2" aria-busy="true">
        <div className="h-7 w-40 bg-gray-100 rounded-md animate-pulse border border-transparent" />
        <div className="h-7 w-44 bg-gray-100 rounded-md animate-pulse border border-transparent" />
        <div className="h-7 w-32 bg-gray-100 rounded-md animate-pulse border border-transparent" />
      </div>
    );
  }

  const chips: {
    key: LoansPortfolioPilotageFilterKey;
    label: string;
    count: number;
    title: string;
  }[] = [
    {
      key: 'negative_cf',
      label: 'Biens avec cashflow négatif après crédit',
      count: negativeCashflowPropertyCount,
      title:
        'Nombre de biens dont le cashflow moyen (12 mois) est inférieur à la somme des mensualités de prêts actifs. Filtre le tableau ; liens directs vers chaque bien (onglet Prêts) lorsque le filtre est actif.',
    },
    {
      key: 'heavy_payment',
      label: 'Mensualité > 80 % du cashflow',
      count: heavyPaymentLoanCount,
      title:
        'Prêts actifs dont la mensualité dépasse 80 % du cashflow moyen du bien (12 mois, cashflow > 0). Filtre le tableau sur ces lignes.',
    },
    {
      key: 'high_rate',
      label: 'Taux élevés (> 4 %)',
      count: highRateLoanCount,
      title: 'Prêts actifs à taux strictement supérieur à 4 %. Filtre le tableau sur ces lignes.',
    },
  ];

  return (
    <div className="space-y-2">
      {!compact && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Pilotage portefeuille crédit</h2>
            <p className="text-xs text-gray-600 mt-0.5 max-w-md">
              Identifier les biens à risque et prioriser les actions
            </p>
          </div>
          <p className="text-xs text-gray-500 sm:text-right sm:max-w-xs shrink-0">
            Un clic applique le filtre sur le tableau ci-dessous (cumulé avec les filtres classiques)
          </p>
        </div>
      )}
      {compact && (
        <p className="text-xs font-medium text-gray-600">
          Filtrer le tableau par type de risque
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Raccourcis pilotage prêts"
        >
          {chips.map(({ key, label, count, title }) => (
            <button
              key={key}
              type="button"
              onClick={() => count > 0 && onApplyFilter(key)}
              disabled={count === 0}
              aria-pressed={activeFilter === key}
              title={title}
              className={cn(
                chipBase,
                'inline-flex items-center gap-1.5 max-w-full text-left',
                count === 0 && 'opacity-45 cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400',
                count > 0 &&
                  activeFilter !== key &&
                  'cursor-pointer bg-white border-gray-300 text-gray-700 hover:bg-gray-50',
                count > 0 &&
                  activeFilter === key &&
                  'cursor-pointer border-primary-400 bg-primary-100 text-primary-900 shadow-sm ring-1 ring-primary-200/80',
              )}
            >
              <span className="leading-tight">{label}</span>
              <span className="tabular-nums text-[11px] opacity-90 shrink-0">{count}</span>
            </button>
          ))}
        </div>
        {activeFilter !== null && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 border-primary-200 text-primary-800 hover:bg-primary-50"
            onClick={onResetPilotage}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            Réinitialiser les filtres pilotage
          </Button>
        )}
      </div>

      {activeFilter === 'negative_cf' && negativeCashflowPropertyLinks.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-200/90 bg-white/70 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-2">
            Accès direct aux biens concernés
          </p>
          <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-2">
            {negativeCashflowPropertyLinks.map(({ id, name }) => (
              <li key={id}>
                <Link
                  href={propertyLoansTabHref(id)}
                  className="inline-flex flex-wrap items-baseline gap-x-1.5 text-sm text-slate-800 hover:text-orange-700"
                >
                  <span className="font-medium">{name}</span>
                  <span className="text-xs font-medium text-orange-600 hover:underline">Voir le bien</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
