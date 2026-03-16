'use client';

import React from 'react';
import { cn } from '@/utils/cn';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';

/** Convertit le score de gravité (0~10, plus haut = pire) en indice santé 0-100 (plus haut = mieux). */
export function gravityToHealthIndex(gravityScore: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - gravityScore * 12)));
}

export type IndiceLabel = 'Bon' | 'À surveiller' | 'Critique';

export function getIndiceLabel(healthIndex: number): IndiceLabel {
  if (healthIndex >= 70) return 'Bon';
  if (healthIndex >= 40) return 'À surveiller';
  return 'Critique';
}

function TooltipContentText() {
  return (
    <div className="space-y-1">
      <p>L&apos;indice portefeuille reflète la santé globale de votre gestion. Il prend en compte :</p>
      <ul className="list-disc list-inside space-y-0.5 text-slate-600">
        <li>loyers en retard</li>
        <li>transactions non rapprochées</li>
        <li>indexations non appliquées</li>
        <li>échéances proches</li>
      </ul>
    </div>
  );
}

export interface IndicePortefeuilleProps {
  /** Score de gravité du dashboard (0 à ~10) */
  gravityScore: number;
  className?: string;
}

export function IndicePortefeuille({ gravityScore, className }: IndicePortefeuilleProps) {
  const healthIndex = gravityToHealthIndex(gravityScore);
  const label = getIndiceLabel(healthIndex);
  const barColor =
    healthIndex >= 70
      ? 'bg-emerald-500'
      : healthIndex >= 40
        ? 'bg-amber-500'
        : 'bg-red-500';
  const scoreColor =
    healthIndex >= 70
      ? 'text-emerald-600'
      : healthIndex >= 40
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'inline-flex flex-col rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 shadow-sm',
            'w-[160px] max-w-[180px]',
            'cursor-help',
            className
          )}
        >
          <div className="flex items-center justify-between gap-0.5 w-full">
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
              Indice portefeuille
            </span>
            <span className="text-slate-400 hover:text-slate-600" aria-hidden>
              <Info className="h-2.5 w-2.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-0.5 mt-0.5">
            <span className={cn('text-base font-semibold tabular-nums', scoreColor)}>
              {healthIndex}
            </span>
            <span className="text-[10px] text-slate-400">/ 100</span>
          </div>
          <span className="text-[10px] font-medium text-slate-600 mt-0.5 capitalize">{label}</span>
          <div className="w-full mt-1 h-1 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
            <div
              className={cn('h-full rounded-full transition-all duration-500', barColor)}
              style={{ width: `${healthIndex}%` }}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end" className="max-w-[240px] text-xs">
        <TooltipContentText />
      </TooltipContent>
    </Tooltip>
  );
}
