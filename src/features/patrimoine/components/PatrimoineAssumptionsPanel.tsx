'use client';

/* eslint-disable @typescript-eslint/naming-convention -- composant React (PascalCase) */

import React, { useCallback } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatCurrencyEUR } from '@/utils/format';
import type { PatrimoineSnapshotResult } from '@/features/patrimoine/hooks/usePatrimoineSnapshot';
import type { PatrimoineUserSettings } from '@/features/patrimoine/store/patrimoineSettings';
import { getPatrimoineSettingsDefaults } from '@/features/patrimoine/store/patrimoineSettings';
import { Button } from '@/components/ui/Button';

export interface PatrimoineAssumptionsPanelProps {
  organizationId: string | undefined;
  settings: PatrimoineUserSettings;
  onSettingsChange: (patch: Partial<PatrimoineUserSettings>) => void;
  snapshot: PatrimoineSnapshotResult;
  className?: string;
}

function objectiveLabel(o: PatrimoineUserSettings['objective']): string {
  if (o === 'croissance') return 'Croissance';
  if (o === 'securite') return 'Sécurité';
  return 'Équilibre';
}

export function PatrimoineAssumptionsPanel({
  organizationId,
  settings,
  onSettingsChange,
  snapshot,
  className,
}: PatrimoineAssumptionsPanelProps) {
  const handleField = useCallback(
    (patch: Partial<PatrimoineUserSettings>) => {
      if (!organizationId) return;
      onSettingsChange(patch);
    },
    [organizationId, onSettingsChange]
  );

  const handleReset = useCallback(() => {
    if (!organizationId) return;
    const d = getPatrimoineSettingsDefaults();
    onSettingsChange({
      cashDisponible: d.cashDisponible,
      cashSecurite: d.cashSecurite,
      peaEtfValue: d.peaEtfValue,
      dcaDayOfMonth: d.dcaDayOfMonth,
      objective: d.objective,
    });
    window.dispatchEvent(new CustomEvent('patrimoine:refresh'));
  }, [organizationId, onSettingsChange]);

  const disabled = !organizationId;

  const summaryLine = [
    formatCurrencyEUR(settings.cashDisponible),
    formatCurrencyEUR(settings.cashSecurite),
    formatCurrencyEUR(settings.peaEtfValue),
    objectiveLabel(settings.objective),
    `J${settings.dcaDayOfMonth}`,
  ].join(' · ');

  return (
    <details
      className={cn(
        'group rounded-xl border border-slate-200/90 bg-white shadow-sm open:ring-1 open:ring-slate-200/50',
        className
      )}
    >
      <summary className="flex cursor-pointer list-none items-start gap-2 px-2.5 py-2 sm:items-center sm:px-3 sm:py-2">
        <ChevronDown
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180 sm:mt-0"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-slate-900 sm:text-sm">Hypothèses patrimoine</span>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500 line-clamp-2 sm:text-[11px]" title={summaryLine}>
            {summaryLine}
          </p>
        </div>
      </summary>

      <div className="border-t border-slate-100 px-2.5 pb-2.5 pt-2 sm:px-3 sm:pb-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">Cash disponible</span>
            <input
              type="number"
              min={0}
              step={100}
              disabled={disabled}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums disabled:opacity-50 sm:text-sm"
              value={settings.cashDisponible || ''}
              placeholder="0"
              onChange={(e) => handleField({ cashDisponible: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">Cash sécurité</span>
            <input
              type="number"
              min={0}
              step={100}
              disabled={disabled}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums disabled:opacity-50 sm:text-sm"
              value={settings.cashSecurite}
              onChange={(e) => handleField({ cashSecurite: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">ETF / PEA</span>
            <input
              type="number"
              min={0}
              step={100}
              disabled={disabled}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums disabled:opacity-50 sm:text-sm"
              value={settings.peaEtfValue || ''}
              placeholder="0"
              onChange={(e) => handleField({ peaEtfValue: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">Objectif</span>
            <select
              disabled={disabled}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-50 sm:text-sm"
              value={settings.objective}
              onChange={(e) =>
                handleField({
                  objective: e.target.value as PatrimoineUserSettings['objective'],
                })
              }
            >
              <option value="equilibre">Équilibre</option>
              <option value="croissance">Croissance</option>
              <option value="securite">Sécurité</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">Jour DCA</span>
            <input
              type="number"
              min={1}
              max={31}
              disabled={disabled}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums disabled:opacity-50 sm:text-sm"
              value={settings.dcaDayOfMonth}
              onChange={(e) => handleField({ dcaDayOfMonth: Number(e.target.value) || 5 })}
            />
          </label>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <p className="text-[10px] text-slate-500 sm:text-[11px]">
            Excédent cash : <strong className="text-slate-700">{formatCurrencyEUR(snapshot.cashExcess)}</strong>
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className="h-8 shrink-0 gap-1 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-xs"
            onClick={handleReset}
          >
            <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
            Réinitialiser
          </Button>
        </div>
      </div>
    </details>
  );
}
