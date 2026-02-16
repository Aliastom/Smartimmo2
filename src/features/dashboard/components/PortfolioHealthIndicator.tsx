'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, Flame } from 'lucide-react';
import { cn } from '@/utils/cn';

export type HealthLabelColor = 'emerald' | 'amber' | 'orange' | 'red';

export interface HealthLabelResult {
  label: string;
  subtitle: string;
  color: HealthLabelColor;
}

export function getHealthLabel(score: number): HealthLabelResult {
  if (score <= 2) {
    return { label: 'Sain', subtitle: 'Situation stable', color: 'emerald' };
  }
  if (score <= 5) {
    return { label: 'Sous surveillance', subtitle: 'Quelques points d\'attention', color: 'amber' };
  }
  if (score <= 8) {
    return { label: 'Tension', subtitle: 'Risque à court terme', color: 'orange' };
  }
  return { label: 'Critique', subtitle: 'Action urgente requise', color: 'red' };
}

const PILL_ICON: Record<HealthLabelColor, React.ElementType> = {
  emerald: CheckCircle2,
  amber: AlertCircle,
  orange: AlertTriangle,
  red: Flame,
};

const PILL_ICON_STYLE: Record<HealthLabelColor, string> = {
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  amber: 'bg-amber-50 text-amber-600 border-amber-200',
  orange: 'bg-slate-100 text-slate-600 border-slate-200',
  red: 'bg-red-50 text-red-600 border-red-200',
};

const PILL_LABEL_COLOR: Record<HealthLabelColor, string> = {
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  orange: 'text-slate-700',
  red: 'text-red-700',
};

export interface PortfolioHealthInlineProps {
  gravityScore: number;
  className?: string;
}

/** Status pill compact : 1 ligne, hauteur ~32–36px, aligné au titre. */
export function PortfolioHealthInline({
  gravityScore,
  className,
}: PortfolioHealthInlineProps) {
  const { label, subtitle, color } = getHealthLabel(gravityScore);
  const Icon = PILL_ICON[color];

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 shadow-sm',
        'h-[32px] min-h-[32px] max-h-[36px]',
        className
      )}
    >
      <span
        className={cn(
          'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border',
          PILL_ICON_STYLE[color]
        )}
      >
        <Icon className="h-3.5 w-3.5 opacity-80" aria-hidden />
      </span>
      <span className="text-xs text-slate-500">Indice portefeuille</span>
      <span className={cn('text-xs font-semibold', PILL_LABEL_COLOR[color])}>
        {label}
      </span>
      <span className="text-slate-300">•</span>
      <span className="text-xs text-slate-500">{subtitle}</span>
    </motion.div>
  );
}
