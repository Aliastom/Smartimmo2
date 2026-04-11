'use client';

import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { LeasePriorityAction } from '../utils/buildLeasePriorityActions';

export interface LeasesGlobalActionsBarProps {
  priorityActions: LeasePriorityAction[];
  isLoading?: boolean;
  pilotageAvailable: boolean;
  onBatchEncaisserRetards: (items: LeasePriorityAction[]) => void;
  onBatchCompleterPartiels: (items: LeasePriorityAction[]) => void;
  onTraiterCritiques: (items: LeasePriorityAction[]) => void;
}

function fmtEuro(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
}

export function LeasesGlobalActionsBar({
  priorityActions,
  isLoading = false,
  pilotageAvailable,
  onBatchEncaisserRetards,
  onBatchCompleterPartiels,
  onTraiterCritiques,
}: LeasesGlobalActionsBarProps) {
  const retards = priorityActions.filter((a) => a.nextActionType === 'PAY_FULL');
  const partiels = priorityActions.filter((a) => a.nextActionType === 'PAY_REMAINING');
  const critiques = priorityActions.filter((a) =>
    ['PAY_FULL', 'PAY_REMAINING', 'INDEXATION', 'RENEWAL'].includes(a.nextActionType)
  );

  const [confirmOpen, setConfirmOpen] = useState<
    null | { kind: 'retards' | 'partiels' | 'critiques'; items: LeasePriorityAction[] }
  >(null);

  if (!pilotageAvailable || isLoading) {
    return null;
  }

  const hasAny = retards.length > 0 || partiels.length > 0 || critiques.length > 0;
  if (!hasAny) return null;

  const runConfirm = () => {
    if (!confirmOpen) return;
    if (confirmOpen.kind === 'retards') onBatchEncaisserRetards(confirmOpen.items);
    else if (confirmOpen.kind === 'partiels') onBatchCompleterPartiels(confirmOpen.items);
    else onTraiterCritiques(confirmOpen.items);
    setConfirmOpen(null);
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Layers className="h-5 w-5 text-slate-700 shrink-0" />
          <h2 className="text-base font-bold text-slate-900">Actions globales</h2>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          {retards.length > 0 && (
            <Button
              type="button"
              variant="outline"
              className="border-red-200 bg-red-50/80 text-red-900 hover:bg-red-100"
              onClick={() => setConfirmOpen({ kind: 'retards', items: retards })}
            >
              Encaisser tous les loyers en retard ({retards.length})
            </Button>
          )}
          {partiels.length > 0 && (
            <Button
              type="button"
              variant="outline"
              className="border-amber-200 bg-amber-50/80 text-amber-950 hover:bg-amber-100"
              onClick={() => setConfirmOpen({ kind: 'partiels', items: partiels })}
            >
              Compléter tous les paiements partiels ({partiels.length})
            </Button>
          )}
          {critiques.length > 0 && (
            <Button
              type="button"
              variant="outline"
              className="border-orange-200 bg-orange-50/80 text-orange-950 hover:bg-orange-100"
              onClick={() => setConfirmOpen({ kind: 'critiques', items: critiques })}
            >
              Traiter les {critiques.length} baux critiques
            </Button>
          )}
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col border border-gray-200">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                {confirmOpen.kind === 'retards' && 'Encaisser les loyers en retard'}
                {confirmOpen.kind === 'partiels' && 'Compléter les paiements partiels'}
                {confirmOpen.kind === 'critiques' && 'Traiter les baux critiques'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {confirmOpen.items.length} bail{confirmOpen.items.length > 1 ? 'x' : ''} — les encaissements
                s&apos;ouvriront un par un après validation.
              </p>
            </div>
            <ul className="p-4 overflow-y-auto text-sm space-y-2 border-b border-gray-100">
              {confirmOpen.items.map((a) => (
                <li key={`${a.leaseId}-${a.nextActionType}`} className="flex justify-between gap-2 text-gray-800">
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{a.primaryLabel}</span>
                    <span className="block text-xs text-gray-600 truncate">
                      {a.propertyName} · {a.tenantLine}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium">{a.amountLabel}</span>
                </li>
              ))}
              <li className="pt-2 text-xs text-gray-500 border-t border-gray-100">
                Total indicatif : {fmtEuro(confirmOpen.items.reduce((s, i) => s + (i.amountValue > 0 ? i.amountValue : 0), 0))}
              </li>
            </ul>
            <div className="p-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setConfirmOpen(null)}>
                Annuler
              </Button>
              <Button type="button" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={runConfirm}>
                Valider et commencer
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
