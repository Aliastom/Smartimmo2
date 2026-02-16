'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { DashboardSummaryStructured } from '../utils/dashboardSummary';
import { cn } from '@/utils/cn';

const ICON_MAP = {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
};

export interface DashboardSummaryBlockProps {
  summary: DashboardSummaryStructured;
  /** Délai entre chaque mot (s) pour le stagger */
  wordDelay?: number;
  className?: string;
}

function splitWords(line: string): string[] {
  return line.split(/(\s+)/).filter(Boolean);
}

export function DashboardSummaryBlock({
  summary,
  wordDelay = 0.03,
  className,
}: DashboardSummaryBlockProps) {
  const Icon = ICON_MAP[summary.icon];

  const iconColor =
    summary.type === 'critical'
      ? 'text-red-600'
      : summary.type === 'warning'
        ? 'text-amber-600'
        : 'text-emerald-600';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm',
        className
      )}
    >
      <div className="flex gap-3">
        <div className={cn('flex-shrink-0 pt-0.5', iconColor)}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {summary.lines.map((line, lineIndex) => (
            <p key={lineIndex} className="text-sm text-gray-700 leading-relaxed">
              {splitWords(line).map((word, wordIndex) => (
                <motion.span
                  key={`${lineIndex}-${wordIndex}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    delay: lineIndex * 0.15 + wordIndex * wordDelay,
                    duration: 0.25,
                    ease: 'easeOut',
                  }}
                  className="inline"
                >
                  {word}
                </motion.span>
              ))}
            </p>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
