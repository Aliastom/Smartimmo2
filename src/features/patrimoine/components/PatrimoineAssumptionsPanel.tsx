'use client';

/* eslint-disable @typescript-eslint/naming-convention -- composant React (PascalCase) */

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatCurrencyEUR } from '@/utils/format';
import type { PatrimoineSnapshotResult } from '@/features/patrimoine/hooks/usePatrimoineSnapshot';
import type { PatrimoineUserSettings } from '@/features/patrimoine/store/patrimoineSettings';
import { getPatrimoineSettingsDefaults } from '@/features/patrimoine/store/patrimoineSettings';
import { Button } from '@/components/ui/Button';

export interface PatrimoineAssumptionsPanelProps {
  organizationId: string | undefined;
  /** Dernière sauvegarde locale (localStorage). */
  savedSettings: PatrimoineUserSettings;
  snapshot: PatrimoineSnapshotResult;
  /** Persistance complète + le parent déclenche `patrimoine:refresh`. */
  onCommit: (next: PatrimoineUserSettings) => void;
  onDirtyChange?: (dirty: boolean) => void;
  className?: string;
}

function objectiveLabel(o: PatrimoineUserSettings['objective']): string {
  if (o === 'croissance') return 'Croissance';
  if (o === 'securite') return 'Sécurité';
  return 'Équilibre';
}

function ReadOnlyMarketHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] italic text-slate-500 sm:text-[11px]" data-testid="market-pilot-hint">
      {children}
    </p>
  );
}

export function PatrimoineAssumptionsPanel({
  organizationId,
  savedSettings,
  snapshot,
  onCommit,
  onDirtyChange,
  className,
}: PatrimoineAssumptionsPanelProps) {
  const [draft, setDraft] = useState<PatrimoineUserSettings>(savedSettings);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!isDirty) {
      setDraft(savedSettings);
    }
  }, [savedSettings, isDirty]);

  const setDirty = useCallback(
    (dirty: boolean) => {
      setIsDirty(dirty);
      onDirtyChange?.(dirty);
    },
    [onDirtyChange]
  );

  const bumpDraft = useCallback(
    (patch: Partial<PatrimoineUserSettings>) => {
      if (!organizationId) return;
      setDraft((d) => ({ ...d, ...patch }));
      setDirty(true);
    },
    [organizationId, setDirty]
  );

  const handleValidate = useCallback(() => {
    if (!organizationId) return;
    onCommit(draft);
    setDirty(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('patrimoine:refresh'));
    }
  }, [organizationId, draft, onCommit, setDirty]);

  const handleCancel = useCallback(() => {
    setDraft(savedSettings);
    setDirty(false);
  }, [savedSettings, setDirty]);

  const handleReset = useCallback(() => {
    if (!organizationId) return;
    const d = getPatrimoineSettingsDefaults();
    onCommit(d);
    setDraft(d);
    setDirty(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('patrimoine:refresh'));
    }
  }, [organizationId, onCommit, setDirty]);

  const disabled = !organizationId;
  const marketCash = snapshot.sourceCash === 'MARKET';
  const marketDcaAmt = snapshot.sourceDca === 'MARKET';
  const marketDcaDay = snapshot.sourceDcaDay === 'MARKET';

  const previewCashDisponible = marketCash ? snapshot.cashDisponible : draft.cashDisponible;
  const previewExcess = Math.max(0, previewCashDisponible - draft.cashSecurite);

  const summaryLine = [
    formatCurrencyEUR(previewCashDisponible),
    formatCurrencyEUR(draft.cashSecurite),
    formatCurrencyEUR(draft.peaEtfValue),
    objectiveLabel(draft.objective),
    `J${marketDcaDay ? snapshot.effectiveDcaDayOfMonth : draft.dcaDayOfMonth}`,
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-900 sm:text-sm">Hypothèses patrimoine</span>
            {isDirty ? (
              <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-950 ring-1 ring-amber-200/80">
                Modifications non enregistrées
              </span>
            ) : (
              <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-900 ring-1 ring-emerald-200/70">
                Hypothèses sauvegardées
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500 line-clamp-2 sm:text-[11px]" title={summaryLine}>
            {summaryLine}
          </p>
        </div>
      </summary>

      <div className="border-t border-slate-100 px-2.5 pb-2.5 pt-2 sm:px-3 sm:pb-3">
        {isDirty && (
          <p className="mb-2 text-[10px] text-amber-800 sm:text-[11px]">
            Les pastilles « Sources » sous le résumé reflètent la dernière sauvegarde jusqu’à validation.
          </p>
        )}

        <div className="mb-3 space-y-2 border-b border-slate-100 pb-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[11px]">Sources</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">Fiscalité</span>
              <select
                disabled={disabled}
                className="max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-50 sm:text-sm"
                aria-label="Simulation fiscale utilisée pour le cockpit patrimoine"
                value={draft.selectedFiscalSimulationId ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  bumpDraft({ selectedFiscalSimulationId: v === '' ? null : v });
                }}
              >
                <option value="">Auto — dernière valide</option>
                {snapshot.availableFiscalSimulations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">Marché</span>
              <select
                disabled={disabled}
                className="max-w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-50 sm:text-sm"
                aria-label="Profil marché utilisé pour le cockpit patrimoine"
                value={draft.selectedMarketInvestmentId ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  bumpDraft({ selectedMarketInvestmentId: v === '' ? null : v });
                }}
              >
                <option value="">Auto — profil principal</option>
                {snapshot.availableMarketInvestments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-[10px] text-slate-500 sm:text-[11px]">Fiscalité :</span>
            {!snapshot.hasFiscalSimulation ? (
              <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-950 ring-1 ring-amber-200/70">
                Non reliée
              </span>
            ) : (
              <>
                {snapshot.fiscalSimulationSelectionMode === 'AUTO' && (
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200/80">
                    Auto
                  </span>
                )}
                {snapshot.fiscalSimulationSelectionMode === 'MANUAL' && (
                  <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-900 ring-1 ring-indigo-200/70">
                    Manuelle
                  </span>
                )}
                {snapshot.fiscalSimulationSelectionMode === 'MISSING_FALLBACK' && (
                  <span className="inline-flex max-w-full rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-950 ring-1 ring-orange-200/80">
                    Introuvable — fallback auto
                  </span>
                )}
              </>
            )}
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <span className="text-[10px] text-slate-500 sm:text-[11px]">Marché :</span>
            {snapshot.availableMarketInvestments.length === 0 ? (
              <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200/80">
                Non disponible
              </span>
            ) : (
              <>
                {snapshot.marketInvestmentSelectionMode === 'AUTO' && (
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200/80">
                    Auto
                  </span>
                )}
                {snapshot.marketInvestmentSelectionMode === 'MANUAL' && (
                  <span className="inline-flex rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-900 ring-1 ring-indigo-200/70">
                    Manuel
                  </span>
                )}
                {snapshot.marketInvestmentSelectionMode === 'MISSING_FALLBACK' && (
                  <span className="inline-flex max-w-full rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-950 ring-1 ring-orange-200/80">
                    Introuvable — fallback auto
                  </span>
                )}
              </>
            )}
          </div>
          {(() => {
            const parts = [snapshot.fiscalSimulationWarning, snapshot.marketSelectionWarning].filter(
              (w): w is string => Boolean(w && w.trim())
            );
            const uniq = [...new Set(parts)];
            if (uniq.length === 0) return null;
            return (
              <p className="line-clamp-2 text-[10px] leading-snug text-orange-800 sm:text-[11px]" role="status">
                {uniq.join(' · ')}
              </p>
            );
          })()}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {marketCash ? (
            <div className="flex flex-col gap-0.5 rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-1.5">
              <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">Cash disponible</span>
              <span className="text-xs font-semibold tabular-nums text-slate-900 sm:text-sm">
                {formatCurrencyEUR(snapshot.cashDisponible)}
              </span>
              <ReadOnlyMarketHint>Piloté par le profil Marché (availableCash).</ReadOnlyMarketHint>
            </div>
          ) : (
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">Cash disponible</span>
              <input
                type="number"
                min={0}
                step={100}
                disabled={disabled}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums disabled:opacity-50 sm:text-sm"
                data-testid="input-cash-disponible"
                value={draft.cashDisponible || ''}
                placeholder="0"
                onChange={(e) => bumpDraft({ cashDisponible: Number(e.target.value) || 0 })}
              />
            </label>
          )}

          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">Cash sécurité</span>
            <input
              type="number"
              min={0}
              step={100}
              disabled={disabled}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums disabled:opacity-50 sm:text-sm"
              value={draft.cashSecurite}
              onChange={(e) => bumpDraft({ cashSecurite: Number(e.target.value) || 0 })}
            />
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">ETF / PEA (estimation)</span>
            <input
              type="number"
              min={0}
              step={100}
              disabled={disabled}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums disabled:opacity-50 sm:text-sm"
              value={draft.peaEtfValue || ''}
              placeholder="0"
              onChange={(e) => bumpDraft({ peaEtfValue: Number(e.target.value) || 0 })}
            />
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">Objectif</span>
            <select
              disabled={disabled}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs disabled:opacity-50 sm:text-sm"
              value={draft.objective}
              onChange={(e) =>
                bumpDraft({
                  objective: e.target.value as PatrimoineUserSettings['objective'],
                })
              }
            >
              <option value="equilibre">Équilibre</option>
              <option value="croissance">Croissance</option>
              <option value="securite">Sécurité</option>
            </select>
          </label>

          {marketDcaAmt ? (
            <div className="flex flex-col gap-0.5 rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-1.5">
              <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">DCA mensuel (réf.)</span>
              <span className="text-xs font-semibold tabular-nums text-slate-900 sm:text-sm">
                {formatCurrencyEUR(snapshot.dcaRecommended)}
              </span>
              <ReadOnlyMarketHint>Piloté par le profil Marché.</ReadOnlyMarketHint>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5 rounded-lg border border-dashed border-slate-200 px-2 py-1.5">
              <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">DCA mensuel (réf.)</span>
              <span className="text-xs font-semibold tabular-nums text-slate-800 sm:text-sm">
                {formatCurrencyEUR(snapshot.dcaRecommended)}
              </span>
              <ReadOnlyMarketHint>Selon la recommandation Patrimoine (pas de profil Marché).</ReadOnlyMarketHint>
            </div>
          )}

          {marketDcaDay ? (
            <div className="flex flex-col gap-0.5 rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-1.5">
              <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">Jour DCA</span>
              <span className="text-xs font-semibold text-slate-900 sm:text-sm">{snapshot.effectiveDcaDayOfMonth}</span>
              <ReadOnlyMarketHint>Piloté par le profil Marché.</ReadOnlyMarketHint>
            </div>
          ) : (
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-slate-600 sm:text-[11px]">Jour DCA</span>
              <input
                type="number"
                min={1}
                max={31}
                disabled={disabled}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs tabular-nums disabled:opacity-50 sm:text-sm"
                data-testid="input-dca-day"
                value={draft.dcaDayOfMonth}
                onChange={(e) => bumpDraft({ dcaDayOfMonth: Number(e.target.value) || 5 })}
              />
            </label>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
          <p className="text-[10px] text-slate-500 sm:text-[11px]">
            Excédent cash (aperçu) :{' '}
            <strong className="text-slate-700">{formatCurrencyEUR(previewExcess)}</strong>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || !isDirty}
              className="h-8 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-xs"
              onClick={handleCancel}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="h-8 gap-1 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-xs"
              onClick={handleReset}
            >
              <RotateCcw className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
              Réinitialiser
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={disabled || !isDirty}
              className="h-8 px-2 text-[11px] sm:h-9 sm:px-3 sm:text-xs"
              data-testid="btn-validate-assumptions"
              onClick={handleValidate}
            >
              Valider les hypothèses
            </Button>
          </div>
        </div>
      </div>
    </details>
  );
}
