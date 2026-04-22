/**
 * FiscalHeaderControls - Sélecteurs Déclaration / Barème + badges (Espace fiscal)
 * Persistance via FiscalSession, compatible offline (cache IDB).
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useFiscalSession } from '@/hooks/useFiscalSession';
import { Badge } from '@/components/ui/Badge';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import { Loader2, Calendar, FileText, Scale } from 'lucide-react';

const DECLARATION_YEARS = Array.from({ length: 14 }, (_, i) => 2022 + i); // 2022..2035

export type FiscalHeaderControlsVariant = 'default' | 'toolbar' | 'cockpit';

export interface FiscalHeaderControlsProps {
  /** default: carte complète + badges récap. toolbar: bandeau dense. cockpit: ligne cockpit centrée, premium. */
  variant?: FiscalHeaderControlsVariant;
}

export function FiscalHeaderControls({ variant = 'default' }: FiscalHeaderControlsProps) {
  const { session, loading, error, updateSession, isOffline } = useFiscalSession();
  const [baremes, setBaremes] = useState<{ code: string; year: number; source: string; updatedAt: string }[]>([]);
  const [loadingBaremes, setLoadingBaremes] = useState(false);
  const [updating, setUpdating] = useState(false);

  const declarationYearForBaremes = session?.declarationYear ?? new Date().getFullYear() + 1;

  useEffect(() => {
    if (declarationYearForBaremes < 2020 || declarationYearForBaremes > 2035) return;
    let cancelled = false;
    setLoadingBaremes(true);
    fetch(`/api/fiscal/baremes?year=${declarationYearForBaremes}`)
      .then((res) => (res.ok ? res.json() : { baremes: [] }))
      .then((data) => {
        if (!cancelled) setBaremes(data.baremes || []);
      })
      .catch(() => {
        if (!cancelled) setBaremes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingBaremes(false);
      });
    return () => { cancelled = true; };
  }, [declarationYearForBaremes]);

  const handleDeclarationChange = async (value: string) => {
    const year = parseInt(value, 10);
    if (Number.isNaN(year)) return;
    console.log('[Fiscal] Combobox Déclaration changée →', year);
    setUpdating(true);
    try {
      await updateSession({ declarationYear: year });
      console.log('[Fiscal] Session mise à jour après déclaration', year);
    } finally {
      setUpdating(false);
    }
  };

  const handleBaremeChange = async (value: string) => {
    if (!value) return;
    setUpdating(true);
    try {
      await updateSession({ baremeCode: value });
    } finally {
      setUpdating(false);
    }
  };

  const isToolbar = variant === 'toolbar';
  const isCockpit = variant === 'cockpit';
  const compactChrome = isToolbar || isCockpit;

  if (loading && !session) {
    return (
      <div
        className={`flex items-center gap-3 rounded-lg bg-gray-100/80 ${
          compactChrome ? 'py-1.5 px-2' : 'py-2 px-3'
        }`}
      >
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        <span className="text-sm text-gray-600">Chargement de la session...</span>
      </div>
    );
  }

  if (!session) return null;

  const baremeOption = baremes.find((b) => b.code === session.baremeCode);
  const baremeLabel = baremeOption
    ? `${session.baremeCode} (${baremeOption.source})`
    : session.baremeCode;

  const labelClass = isCockpit
    ? 'text-[10px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap'
    : 'text-xs font-medium text-gray-600 whitespace-nowrap';

  return (
    <div
      className={
        isCockpit
          ? 'flex w-full max-w-md flex-nowrap items-center justify-center gap-x-2.5 gap-y-0 rounded-2xl border border-gray-200/70 bg-white/75 px-2.5 py-1.5 shadow-sm backdrop-blur-md sm:gap-x-3 sm:px-3 sm:py-2 xl:max-w-none'
          : isToolbar
            ? 'flex flex-wrap items-center gap-2 sm:gap-3 py-1.5 px-2 sm:px-2.5 rounded-md bg-gray-50/90 border border-gray-200/70'
            : 'flex flex-wrap items-center gap-4 py-2 px-3 rounded-lg bg-gray-50/80 border border-gray-200/80'
      }
    >
      <TooltipProvider>
        {/* Select Déclaration */}
        <div className={`flex items-center ${isCockpit ? 'gap-1.5' : 'gap-2'}`}>
          <Label className={labelClass}>Déclaration</Label>
          <div className={`relative ${isCockpit ? 'w-[84px]' : 'w-[100px]'}`}>
            {updating && (
              <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              </div>
            )}
            <Select
              value={String(session.declarationYear)}
              onChange={(e) => handleDeclarationChange(e.target.value)}
              disabled={updating || isOffline}
              options={DECLARATION_YEARS.map((y) => ({ value: String(y), label: String(y) }))}
              className={isCockpit ? 'h-8 text-sm font-medium' : 'h-8 text-sm'}
            />
          </div>
        </div>

        {isCockpit && <span className="h-6 w-px shrink-0 bg-gray-200/90" aria-hidden />}

        {/* Revenus (lecture seule) */}
        <div className={`flex items-center ${isCockpit ? 'gap-1.5' : 'gap-2'}`}>
          <Label className={labelClass}>Revenus</Label>
          <span
            className={
              isCockpit
                ? 'min-w-[2.25rem] text-center text-sm font-semibold tabular-nums text-gray-900'
                : 'text-sm font-medium text-gray-800 tabular-nums'
            }
          >
            {session.incomeYear}
          </span>
        </div>

        {isCockpit && <span className="h-6 w-px shrink-0 bg-gray-200/90" aria-hidden />}

        {/* Select Barème */}
        <div className={`flex min-w-0 items-center ${isCockpit ? 'gap-1.5' : 'gap-2'}`}>
          <Label className={labelClass}>Barème</Label>
          <div className={`relative min-w-0 ${isCockpit ? 'w-[118px] sm:w-[138px]' : 'w-[160px]'}`}>
            {loadingBaremes && (
              <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
              </div>
            )}
            <Select
              value={session.baremeCode}
              onChange={(e) => handleBaremeChange(e.target.value)}
              disabled={updating || isOffline || loadingBaremes}
              options={
                baremes.length > 0
                  ? baremes.map((b) => ({ value: b.code, label: `${b.code} – ${b.source}` }))
                  : [{ value: session.baremeCode, label: session.baremeCode }]
              }
              placeholder="Barème"
              className={isCockpit ? 'h-8 text-sm font-medium' : 'h-8 text-sm'}
            />
          </div>
        </div>

        {/* Badges récap (masqués en toolbar / cockpit) */}
        {!compactChrome && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              <Calendar className="h-3 w-3 mr-1" />
              Déclaration {session.declarationYear}
            </Badge>
            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
              <FileText className="h-3 w-3 mr-1" />
              Revenus {session.incomeYear}
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
                  <Scale className="h-3 w-3 mr-1" />
                  Barème {session.baremeCode}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{baremeLabel}</p>
                {baremeOption?.updatedAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    MAJ {new Date(baremeOption.updatedAt).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
            {isOffline && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                Données locales
              </Badge>
            )}
          </div>
        )}
        {compactChrome && isOffline && (
          <Badge variant="outline" className="border-amber-200/80 bg-amber-50/90 px-1.5 py-0 text-[10px] text-amber-800">
            Données locales
          </Badge>
        )}
      </TooltipProvider>

      {error && (
        <p className="text-xs text-red-600 w-full">{error}</p>
      )}
    </div>
  );
}
