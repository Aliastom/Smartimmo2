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

export function FiscalHeaderControls() {
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

  if (loading && !session) {
    return (
      <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-100/80">
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

  return (
    <div className="flex flex-wrap items-center gap-4 py-2 px-3 rounded-lg bg-gray-50/80 border border-gray-200/80">
      <TooltipProvider>
        {/* Select Déclaration */}
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium text-gray-600 whitespace-nowrap">Déclaration</Label>
          <div className="relative w-[100px]">
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
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* Revenus (lecture seule) */}
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium text-gray-600 whitespace-nowrap">Revenus</Label>
          <span className="text-sm font-medium text-gray-800 tabular-nums">{session.incomeYear}</span>
        </div>

        {/* Select Barème */}
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium text-gray-600 whitespace-nowrap">Barème</Label>
          <div className="relative w-[160px]">
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
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* Badges */}
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
      </TooltipProvider>

      {error && (
        <p className="text-xs text-red-600 w-full">{error}</p>
      )}
    </div>
  );
}
