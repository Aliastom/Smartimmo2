'use client';

/* eslint-disable @typescript-eslint/naming-convention -- composant React (PascalCase) */

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { usePatrimoineActionsStore, formatPatrimoineLastActionRelative } from '@/features/patrimoine/store/patrimoineActionsStore';
import { cn } from '@/utils/cn';

export interface PatrimoineApplyDcaButtonProps {
  organizationId: string | undefined;
  amountEuros: number;
  className?: string;
  /** Style compact (barre paramètres) */
  compact?: boolean;
  /** Afficher la ligne « Dernière action » */
  showLastActionHint?: boolean;
  /** Désactive l’action si aucun profil marché résolu (cockpit Patrimoine). */
  hasMarketProfile?: boolean;
}

export function PatrimoineApplyDcaButton({
  organizationId,
  amountEuros,
  className,
  compact = false,
  showLastActionHint = true,
  hasMarketProfile = true,
}: PatrimoineApplyDcaButtonProps) {
  const hydrate = usePatrimoineActionsStore((s) => s.hydrateLastAppliedFromStorage);
  const applyDca = usePatrimoineActionsStore((s) => s.applyDca);
  const isApplyingDca = usePatrimoineActionsStore((s) => s.isApplyingDca);
  const lastAppliedAt = usePatrimoineActionsStore((s) => s.lastAppliedAt);
  const lastSuccessUiAt = usePatrimoineActionsStore((s) => s.lastSuccessUiAt);

  const [, setTick] = useState(0);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (lastAppliedAt == null) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, [lastAppliedAt]);

  const buttonLabel = (() => {
    if (isApplyingDca) return 'Application…';
    if (lastSuccessUiAt != null) return 'DCA appliqué';
    return 'Appliquer DCA';
  })();

  const relative = formatPatrimoineLastActionRelative(lastAppliedAt);

  const amountOk = Number.isFinite(amountEuros) && amountEuros > 0;
  const profileOk = hasMarketProfile;
  const disabled = !organizationId || isApplyingDca || !amountOk || !profileOk;

  const ariaLabel = (() => {
    if (!organizationId) return 'Organisation requise pour appliquer le DCA';
    if (!profileOk) return 'Aucun profil marché — définis un profil dans le module Marché ou attends la synchro';
    if (!amountOk) return 'Montant DCA invalide ou nul — vérifie les hypothèses';
    if (isApplyingDca) return 'Application du DCA en cours';
    return 'Appliquer le montant DCA aux paramètres marché';
  })();

  return (
    <div className={cn('flex flex-col gap-1', compact ? 'items-end' : '')}>
      <button
        type="button"
        aria-label={ariaLabel}
        title={
          !organizationId
            ? 'Organisation requise'
            : !profileOk
              ? 'Profil marché requis'
              : !amountOk
                ? 'Montant DCA à définir (> 0 €)'
                : undefined
        }
        disabled={disabled}
        onClick={() => {
          if (!organizationId || !amountOk || !profileOk) return;
          void applyDca({ organizationId, amountEuros });
        }}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50',
          compact ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-xs',
          className
        )}
      >
        {isApplyingDca && (
          <Loader2
            className={cn('animate-spin shrink-0', compact ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5')}
            aria-hidden
          />
        )}
        {buttonLabel}
      </button>
      {showLastActionHint && relative && (
        <p className={cn('text-[10px] text-slate-500', compact ? 'text-right max-w-[14rem]' : '')}>
          Dernière action : {relative}
        </p>
      )}
    </div>
  );
}
