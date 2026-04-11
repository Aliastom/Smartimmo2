'use client';

import React, { useMemo, useState } from 'react';
import {
  Euro,
  RefreshCw,
  TrendingUp,
  CalendarClock,
  Scale,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  LOAN_PILOTAGE_END_SOON_MONTHS,
  LOAN_PILOTAGE_HIGH_RATE_PCT,
  type PropertyLoanAggregates,
} from '@/features/loans/utils/propertyLoanPilotage';

export interface PropertyFinancingSummaryBlockProps {
  propertyCashflowMonthly: number;
  mensualiteTotale: number;
  cashflowNet: number;
  crdTotal: number;
  coutRestant: number;
  isLoadingCashflow?: boolean;
  formatCurrency: (n: number) => string;
  /** Pilotage alertes (taux, échéances) — même données que l’ancien LoanInsightsBlock */
  aggregates: PropertyLoanAggregates;
}

type InsightTone = 'warning' | 'danger' | 'info';

interface RecommendedAction {
  icon: React.ReactNode;
  text: string;
}

interface InsightItem {
  key: string;
  tone: InsightTone;
  text: string;
  actions?: RecommendedAction[];
}

function AllRecommendedActionsList({
  blocks,
}: {
  blocks: { key: string; actions: RecommendedAction[] }[];
}) {
  return (
    <ul className="mt-2 space-y-2 border-t border-slate-200/80 pt-3">
      {blocks.flatMap((block) =>
        block.actions.map((a, i) => (
          <li
            key={`${block.key}-${i}`}
            className="flex items-start gap-2 text-xs text-slate-600 leading-snug"
          >
            <span className="mt-0.5 text-slate-400 shrink-0" aria-hidden>
              {a.icon}
            </span>
            <span>{a.text}</span>
          </li>
        )),
      )}
    </ul>
  );
}

export function PropertyFinancingSummaryBlock({
  propertyCashflowMonthly,
  mensualiteTotale,
  cashflowNet,
  crdTotal,
  coutRestant,
  isLoadingCashflow,
  formatCurrency,
  aggregates,
}: PropertyFinancingSummaryBlockProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const netPositive = !isLoadingCashflow && cashflowNet > 0;
  const netNegative = !isLoadingCashflow && cashflowNet < 0;

  const insightItems = useMemo(() => {
    const items: InsightItem[] = [];

    if (!isLoadingCashflow && cashflowNet < 0) {
      items.push({
        key: 'cf',
        tone: 'danger',
        text:
          '⚠️ Cashflow négatif : les mensualités dépassent le cashflow brut du bien (moyenne sur 12 mois).',
        actions: [
          {
            icon: <Euro className="h-3.5 w-3.5" strokeWidth={2} />,
            text: 'Vérifier le niveau de loyer (alignement marché, indexation, vacance).',
          },
          {
            icon: <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />,
            text: 'Envisager une renégociation ou un rachat de crédit pour alléger les mensualités.',
          },
          {
            icon: <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />,
            text: 'Optimiser les charges du bien (travaux, fournisseurs, charges récupérables).',
          },
        ],
      });
    }

    const highRateLoans = aggregates.activeLoans.filter(
      (l) => Number(l.annualRatePct ?? 0) >= LOAN_PILOTAGE_HIGH_RATE_PCT,
    );
    if (highRateLoans.length > 0) {
      items.push({
        key: 'rate',
        tone: 'info',
        text: `Renégociation possible : ${highRateLoans.length} prêt${highRateLoans.length > 1 ? 's' : ''} à taux ≥ ${LOAN_PILOTAGE_HIGH_RATE_PCT} % (${highRateLoans.map((l) => l.label).slice(0, 3).join(', ')}${highRateLoans.length > 3 ? '…' : ''}).`,
        actions: [
          {
            icon: <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} />,
            text: 'Demander une proposition de renégociation ou de modulation à votre organisme prêteur.',
          },
          {
            icon: <Scale className="h-3.5 w-3.5" strokeWidth={2} />,
            text: 'Comparer une offre de rachat / courtage sur la base du CRD et de la durée restante.',
          },
        ],
      });
    }

    const endSoon = aggregates.activeLoans.filter(
      (l) =>
        (l.loanDisplay?.remainingMonths ?? 0) > 0 &&
        (l.loanDisplay?.remainingMonths ?? 0) <= LOAN_PILOTAGE_END_SOON_MONTHS,
    );
    if (endSoon.length > 0) {
      items.push({
        key: 'end',
        tone: 'warning',
        text: `Fin proche : ${endSoon.length} prêt${endSoon.length > 1 ? 's' : ''} se termine${endSoon.length > 1 ? 'nt' : ''} dans moins de ${LOAN_PILOTAGE_END_SOON_MONTHS} mois.`,
        actions: [
          {
            icon: <CalendarClock className="h-3.5 w-3.5" strokeWidth={2} />,
            text: 'Anticiper le solde ou le financement de relais (épargne, nouvelle ligne, calendrier).',
          },
          {
            icon: <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />,
            text: 'Vérifier l’impact sur votre capacité d’emprunt et votre trésorerie globale.',
          },
        ],
      });
    }

    return items;
  }, [aggregates, cashflowNet, isLoadingCashflow]);

  const actionBlocks = useMemo(
    () =>
      insightItems
        .filter((it) => it.actions && it.actions.length > 0)
        .map((it) => ({ key: it.key, actions: it.actions! })),
    [insightItems],
  );
  const hasAnyActions = actionBlocks.length > 0;

  /** Un seul libellé court (priorité danger → warning → info) */
  const shortStatusLine = useMemo(() => {
    if (isLoadingCashflow) return '';
    const danger = insightItems.find((i) => i.tone === 'danger');
    if (danger) {
      return 'Mensualités supérieures au cashflow brut moyen du bien (12 mois).';
    }
    const warning = insightItems.find((i) => i.tone === 'warning');
    if (warning) {
      return warning.text.replace(/^⚠️\s*/, '').trim();
    }
    const info = insightItems.find((i) => i.tone === 'info');
    if (info) {
      return info.text.trim();
    }
    return 'Reste mensuel après les mensualités des prêts actifs — indicateur de soutenabilité.';
  }, [insightItems, isLoadingCashflow]);

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Pilotage du financement</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Analyse de la soutenabilité du crédit pour ce bien
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {/* Section 1 : KPI — carte neutre, couleur uniquement sur le montant */}
        <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Cashflow net après crédit
          </p>
          <div className="mt-2">
            <span
              className={cn(
                'inline-block rounded-lg border px-3 py-2 sm:px-4 sm:py-2.5 tabular-nums tracking-tight transition-colors',
                isLoadingCashflow && 'border-slate-200 bg-slate-50 text-2xl sm:text-3xl font-bold text-slate-500',
                netNegative &&
                  'border-red-200/90 bg-red-50 text-2xl sm:text-3xl font-bold text-red-700',
                netPositive &&
                  'border-emerald-200/90 bg-emerald-50 text-2xl sm:text-3xl font-bold text-emerald-800',
                !isLoadingCashflow &&
                  !netNegative &&
                  !netPositive &&
                  'border-slate-200 bg-slate-50 text-2xl sm:text-3xl font-bold text-slate-800',
              )}
            >
              {isLoadingCashflow ? '…' : formatCurrency(cashflowNet)}
            </span>
          </div>

          {!isLoadingCashflow && (
            <p className="text-xs text-slate-600 mt-3 leading-snug line-clamp-1" title={shortStatusLine}>
              {shortStatusLine}
            </p>
          )}

          {hasAnyActions && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setActionsOpen((o) => !o)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100/90',
                  actionsOpen ? 'rounded-t-lg border-b-0' : 'rounded-lg',
                )}
                aria-expanded={actionsOpen}
              >
                <span>
                  {actionsOpen ? 'Masquer les actions recommandées' : 'Voir les actions recommandées'}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-slate-500 transition-transform',
                    actionsOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>
              {actionsOpen && (
                <div className="rounded-b-lg border border-t-0 border-slate-200/90 bg-white px-3 pb-3 -mt-px">
                  <AllRecommendedActionsList blocks={actionBlocks} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 2 : contexte, contrainte, stock */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-lg bg-white/90 border border-gray-200/90 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Cashflow brut du bien
            </p>
            <p className="text-base font-semibold tabular-nums text-gray-900 mt-0.5">
              {isLoadingCashflow ? '…' : formatCurrency(propertyCashflowMonthly)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Moy. sur 12 mois (transactions)</p>
          </div>

          <div className="rounded-lg bg-white/90 border border-gray-200/90 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Mensualités totales
            </p>
            <p className="text-base font-semibold tabular-nums text-gray-900 mt-0.5">
              {formatCurrency(mensualiteTotale)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Somme des prêts actifs</p>
          </div>

          <div className="rounded-lg bg-white/90 border border-gray-200/90 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">CRD total</p>
            <p className="text-base font-semibold tabular-nums text-gray-900 mt-0.5">
              {formatCurrency(crdTotal)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Capital restant dû</p>
          </div>

          <div className="rounded-lg bg-white/90 border border-gray-200/90 px-3 py-2.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Coût restant</p>
            <p className="text-base font-semibold tabular-nums text-gray-900 mt-0.5">
              {formatCurrency(coutRestant)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">CRD + intérêts restants</p>
          </div>
        </div>
      </div>
    </div>
  );
}
