'use client';

import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';
import { GLOBAL_ROW_DETAIL_LINK_CLASS } from '@/components/global-pilotage';
import type {
  LeasePriorityAction,
  LeasePaymentPilotageMeta,
  LeasePilotageRowMeta,
} from '../utils/buildLeasePriorityActions';

interface LeasesPriorityActionsBlockProps {
  actions: LeasePriorityAction[];
  isLoading?: boolean;
  showAll: boolean;
  onToggleShowAll: () => void;
  onPrimaryCta: (item: LeasePriorityAction) => void;
  /** Scroll vers la ligne du tableau (même bail que l’action). */
  onNavigateToLeaseRow?: (leaseId: string) => void;
  /** Ouvre le détail du bail (drawer). */
  onViewLease?: (leaseId: string) => void;
  /** Montants mois courant (IDB / pilotage). */
  leasePaymentPilotageById?: Record<string, LeasePaymentPilotageMeta>;
  leasePilotageById?: Record<string, LeasePilotageRowMeta>;
  /** Mode normal : pas de données pilotage IDB */
  pilotageAvailable: boolean;
  /** Texte quand aucune action (ex. variante onglet « baux d’un bien »). */
  noActionsMessage?: string;
  /**
   * portfolio = emphase cockpit macro (défaut, page Baux globale).
   * property = bloc plus discret, badge « action(s) », compacité si ≤ 1 action (onglet bien).
   */
  presentation?: 'portfolio' | 'property';
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);

const formatMoneyDetailed = (amount: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

const CASH_TYPES = new Set(['PAY_FULL', 'PAY_REMAINING']);

function shortCtaLabel(item: LeasePriorityAction): string {
  if (item.ctaKind === 'completer') return 'Compléter';
  if (item.ctaKind === 'encaisser') return 'Encaisser';
  return item.ctaLabel;
}

function paymentBadgeTone(
  item: LeasePriorityAction,
  pilotMeta: LeasePilotageRowMeta | undefined
): 'retard' | 'partiel' {
  const g = pilotMeta?.paymentGlobale;
  if (g === 'retard') return 'retard';
  if (g === 'partiel') return 'partiel';
  if (item.nextActionType === 'PAY_REMAINING') return 'partiel';
  return 'retard';
}

export function LeasesPriorityActionsBlock({
  actions,
  isLoading = false,
  showAll,
  onToggleShowAll,
  onPrimaryCta,
  onNavigateToLeaseRow,
  onViewLease,
  leasePaymentPilotageById,
  leasePilotageById,
  pilotageAvailable,
  noActionsMessage,
  presentation = 'portfolio',
}: LeasesPriorityActionsBlockProps) {
  const isProperty = presentation === 'property';
  const compactItems = isProperty && actions.length <= 1;

  const cashActions = useMemo(
    () => actions.filter((a) => CASH_TYPES.has(a.nextActionType)),
    [actions]
  );

  const otherCritiqueActions = useMemo(
    () => actions.filter((a) => !CASH_TYPES.has(a.nextActionType)),
    [actions]
  );

  const portfolioCashTotal = useMemo(() => {
    if (cashActions.length === 0) return 0;
    return cashActions.reduce((s, a) => {
      const p = leasePaymentPilotageById?.[a.leaseId];
      const rest = p?.remaining ?? (a.amountValue > 0 ? a.amountValue : 0);
      return s + rest;
    }, 0);
  }, [cashActions, leasePaymentPilotageById]);

  const hiddenCount = Math.max(0, cashActions.length - 5);
  const displayedCash = useMemo(
    () => (showAll ? cashActions : cashActions.slice(0, 5)),
    [cashActions, showAll]
  );

  const totalAmount = useMemo(
    () => actions.reduce((s, a) => s + (a.amountValue > 0 ? a.amountValue : 0), 0),
    [actions]
  );

  const badgeLabel =
    actions.length > 0
      ? isProperty
        ? `${actions.length} action${actions.length > 1 ? 's' : ''} à traiter`
        : `${actions.length} à traiter`
      : '';

  if (isLoading) {
    return (
      <div
        className={`rounded-xl border-2 bg-white shadow-sm ${
          isProperty ? 'border-red-100 p-3' : 'border-red-200 p-4'
        }`}
      >
        <div className={`h-5 w-48 bg-gray-200 rounded animate-pulse ${isProperty ? 'mb-2' : 'mb-3'}`} />
        <div className="space-y-2">
          {(isProperty ? [1] : [1, 2, 3]).map((i) => (
            <div
              key={i}
              className={`rounded-lg bg-gray-100 animate-pulse ${isProperty ? 'h-12' : 'h-16'}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!pilotageAvailable) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Actions à traiter
        </h2>
        <p className="text-sm text-gray-600 mt-2">
          Le pilotage des loyers (retards, partiels) est disponible dans l&apos;App Shell avec les données locales.
        </p>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div
        className={`rounded-xl border-2 border-emerald-200 bg-emerald-50/50 shadow-sm ${
          isProperty ? 'p-3' : 'p-4'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <h2
            className={
              isProperty ? 'text-base font-semibold text-gray-900' : 'text-lg font-bold text-gray-900'
            }
          >
            {isProperty ? 'Actions prioritaires' : 'Actions à traiter'}
          </h2>
        </div>
        <p className={`text-emerald-800 ${isProperty ? 'text-xs' : 'text-sm'}`}>
          {noActionsMessage ?? 'Aucune action urgente. Les baux actifs sont à jour sur ce périmètre.'}
        </p>
      </div>
    );
  }

  /** Onglet bien : UI compacte inchangée */
  if (isProperty) {
    const hiddenCountProp = Math.max(0, actions.length - 3);
    const displayed = showAll ? actions : actions.slice(0, 3);

    return (
      <div
        className={`rounded-xl border-2 bg-white shadow-sm ${
          isProperty ? 'border-red-200' : 'border-red-300'
        } ${compactItems ? 'p-3' : isProperty ? 'p-3' : 'p-4'}`}
      >
        <div className={`flex flex-wrap items-center justify-between gap-2 ${compactItems ? 'mb-2' : 'mb-3'}`}>
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={`text-red-600 shrink-0 ${isProperty ? 'h-4 w-4' : 'h-5 w-5'}`}
            />
            <h2
              className={
                isProperty ? 'text-base font-semibold text-gray-900' : 'text-lg font-bold text-gray-900'
              }
            >
              Actions prioritaires
            </h2>
          </div>
          <span
            className={cn(
              'inline-flex items-center rounded-full bg-red-100 text-red-800 px-2.5 font-semibold',
              isProperty ? 'py-0.5 text-[11px] sm:text-xs' : 'py-1 text-xs'
            )}
          >
            {badgeLabel}
            {totalAmount > 0 ? ` • ${formatCurrency(totalAmount)}` : ''}
          </span>
        </div>

        <div className={compactItems ? 'space-y-1.5' : 'space-y-2'}>
          {displayed.map((item, idx) => {
            const isFirstCritical = idx === 0 && item.nextActionType === 'PAY_FULL';
            const showProblem =
              item.problemLine && item.problemLine.trim() !== item.primaryLabel.trim();
            const rowNav = onNavigateToLeaseRow
              ? () => onNavigateToLeaseRow(item.leaseId)
              : undefined;
            return (
              <div
                key={`${item.leaseId}-${item.nextActionType}-${item.targetYearMonth ?? ''}`}
                className={`rounded-lg border ${
                  compactItems ? 'p-2' : 'p-3'
                } ${
                  isFirstCritical ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-white'
                }`}
              >
                <div className={`flex flex-wrap items-start justify-between ${compactItems ? 'gap-2' : 'gap-3'}`}>
                  <div
                    className={cn(
                      'min-w-0 flex-1',
                      rowNav && 'cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-orange-500/70'
                    )}
                    role={rowNav ? 'button' : undefined}
                    tabIndex={rowNav ? 0 : undefined}
                    onClick={rowNav}
                    onKeyDown={
                      rowNav
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              rowNav();
                            }
                          }
                        : undefined
                    }
                  >
                    <p
                      className={`font-semibold text-gray-900 truncate ${
                        compactItems ? 'text-sm' : 'text-base'
                      }`}
                    >
                      {item.primaryLabel}
                    </p>
                    <p
                      className={`text-gray-500 truncate ${compactItems ? 'text-[11px] mt-0' : 'text-xs mt-0.5'}`}
                    >
                      {item.propertyName} · {item.tenantLine}
                    </p>
                    {showProblem && (
                      <p
                        className={`text-gray-600 line-clamp-2 ${compactItems ? 'text-[11px]' : 'text-xs mt-0.5'}`}
                      >
                        {item.problemLine}
                      </p>
                    )}
                    <p
                      className={`font-bold text-gray-900 ${compactItems ? 'text-xs mt-0.5' : 'text-sm mt-1'}`}
                    >
                      {item.amountLabel}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className={cn(
                      'shrink-0 bg-orange-600 hover:bg-orange-700 text-white font-semibold',
                      compactItems && 'h-8 px-3 text-xs'
                    )}
                    onClick={() => onPrimaryCta(item)}
                  >
                    {item.ctaLabel}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {hiddenCountProp > 0 && (
          <button
            type="button"
            onClick={onToggleShowAll}
            className={`w-full text-sm font-medium text-orange-700 hover:text-orange-800 hover:bg-orange-50 border border-orange-200 rounded-lg transition-colors ${
              isProperty ? 'mt-2 py-1.5' : 'mt-3 py-2'
            }`}
          >
            {showAll ? 'Voir moins' : `Voir toutes les actions à traiter (+${hiddenCountProp})`}
          </button>
        )}
      </div>
    );
  }

  /** Portefeuille : pas d’actions cash → même principe qu’avant (toutes les actions critiques) */
  if (cashActions.length === 0) {
    const hiddenCountLegacy = Math.max(0, actions.length - 3);
    const displayed = showAll ? actions : actions.slice(0, 3);

    return (
      <div className="rounded-xl border-2 border-red-200 bg-white shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-red-600 shrink-0 h-5 w-5" />
            <h2 className="text-lg font-bold text-gray-900">Actions à traiter</h2>
          </div>
          <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2.5 py-1 text-xs font-semibold">
            {badgeLabel}
            {totalAmount > 0 ? ` • ${formatCurrency(totalAmount)}` : ''}
          </span>
        </div>

        <div className="space-y-2">
          {displayed.map((item, idx) => {
            const isFirstCritical = idx === 0 && item.nextActionType === 'PAY_FULL';
            const showProblem =
              item.problemLine && item.problemLine.trim() !== item.primaryLabel.trim();
            const rowNav = onNavigateToLeaseRow
              ? () => onNavigateToLeaseRow(item.leaseId)
              : undefined;
            return (
              <div
                key={`${item.leaseId}-${item.nextActionType}-${item.targetYearMonth ?? ''}`}
                className={`rounded-lg border p-3 ${
                  isFirstCritical ? 'border-red-300 bg-red-50/40' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div
                    className={cn(
                      'min-w-0 flex-1',
                      rowNav && 'cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-orange-500/70'
                    )}
                    role={rowNav ? 'button' : undefined}
                    tabIndex={rowNav ? 0 : undefined}
                    onClick={rowNav}
                    onKeyDown={
                      rowNav
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              rowNav();
                            }
                          }
                        : undefined
                    }
                  >
                    <p className="font-semibold text-gray-900 truncate text-base">{item.primaryLabel}</p>
                    <p className="text-gray-500 truncate text-xs mt-0.5">
                      {item.propertyName} · {item.tenantLine}
                    </p>
                    {showProblem && (
                      <p className="text-gray-600 line-clamp-2 text-xs mt-0.5">{item.problemLine}</p>
                    )}
                    <p className="font-bold text-gray-900 text-sm mt-1">{item.amountLabel}</p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                    onClick={() => onPrimaryCta(item)}
                  >
                    {item.ctaLabel}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {hiddenCountLegacy > 0 && (
          <button
            type="button"
            onClick={onToggleShowAll}
            className="w-full text-sm font-medium text-orange-700 hover:text-orange-800 hover:bg-orange-50 border border-orange-200 rounded-lg transition-colors mt-3 py-2"
          >
            {showAll ? 'Voir moins' : `Voir toutes les actions à traiter (+${hiddenCountLegacy})`}
          </button>
        )}
      </div>
    );
  }

  /** Portefeuille avec actions cash : carte orientée encaissement */
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/70 shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="text-red-600 shrink-0 h-5 w-5" />
          <h2 className="text-lg font-bold text-gray-900 truncate">Actions à traiter</h2>
        </div>
        <span className="inline-flex items-center rounded-full bg-red-100/90 text-red-900 px-2.5 py-1 text-xs font-semibold tabular-nums shrink-0">
          {cashActions.length} à traiter{portfolioCashTotal > 0 ? ` – ${formatCurrency(portfolioCashTotal)}` : ''}
        </span>
      </div>
      <p className="text-sm text-red-950/80 mb-4 pl-0 sm:pl-7">
        Loyers en attente ou incomplets nécessitant une action.
      </p>

      <div className="space-y-3">
        {displayedCash.map((item) => {
          const pay = leasePaymentPilotageById?.[item.leaseId];
          const pilot = leasePilotageById?.[item.leaseId];
          const tone = paymentBadgeTone(item, pilot);
          const progress = pay ? Math.min(1, Math.max(0, pay.progress01)) : 0;

          return (
            <div
              key={`${item.leaseId}-${item.nextActionType}-${item.targetYearMonth ?? ''}`}
              className="rounded-lg border border-red-100/90 bg-white/95 p-3 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="font-semibold text-gray-900 text-base leading-snug">{item.primaryLabel}</p>
                    <p className="text-sm text-gray-700 mt-0.5">{item.tenantLine}</p>
                    <p className="text-sm text-gray-500">{item.propertyName}</p>
                  </div>

                  {pay ? (
                    <>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
                        <span className="text-gray-600">
                          Attendu{' '}
                          <span className="font-semibold text-gray-900">{formatMoneyDetailed(pay.expected)}</span>
                        </span>
                        <span className="text-gray-600">
                          Encaissé{' '}
                          <span className="font-semibold text-gray-900">{formatMoneyDetailed(pay.paid)}</span>
                        </span>
                        <span className="text-gray-700">
                          Reste{' '}
                          <span
                            className={cn(
                              'font-bold',
                              tone === 'retard' ? 'text-red-700' : 'text-orange-700'
                            )}
                          >
                            {formatMoneyDetailed(pay.remaining)}
                          </span>
                        </span>
                      </div>
                      <div className="h-1 w-full rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-[width]',
                            tone === 'retard' ? 'bg-red-400' : 'bg-orange-400'
                          )}
                          style={{ width: `${progress * 100}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-gray-900">{item.amountLabel}</p>
                  )}
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 border-t border-red-50 pt-3 sm:border-0 sm:pt-0">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                      tone === 'retard'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-orange-100 text-orange-900'
                    )}
                  >
                    {tone === 'retard' ? 'Retard' : 'Partiel'}
                  </span>
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white font-semibold min-w-[7.5rem]"
                    onClick={() => onPrimaryCta(item)}
                  >
                    {shortCtaLabel(item)}
                  </Button>
                  {onViewLease && (
                    <button
                      type="button"
                      className={cn(
                        GLOBAL_ROW_DETAIL_LINK_CLASS,
                        'mt-0 pt-0 w-auto sm:text-right self-center sm:self-end'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewLease(item.leaseId);
                      }}
                    >
                      Voir le bail
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {otherCritiqueActions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-red-200/80">
          <p className="text-xs font-semibold text-red-950/70 uppercase tracking-wide mb-2">
            Autres actions critiques
          </p>
          <div className="space-y-2">
            {otherCritiqueActions.map((item) => (
              <div
                key={`other-${item.leaseId}-${item.nextActionType}`}
                className="rounded-lg border border-gray-200 bg-white/90 p-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.primaryLabel}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {item.tenantLine} · {item.propertyName}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-orange-200 text-orange-800 hover:bg-orange-50"
                  onClick={() => onPrimaryCta(item)}
                >
                  {item.ctaLabel}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={onToggleShowAll}
          className="w-full text-sm font-medium text-orange-800 hover:text-orange-900 hover:bg-orange-50/80 border border-orange-200/80 rounded-lg transition-colors mt-3 py-2"
        >
          {showAll ? 'Voir moins' : `Voir plus (+${hiddenCount})`}
        </button>
      )}
    </div>
  );
}
