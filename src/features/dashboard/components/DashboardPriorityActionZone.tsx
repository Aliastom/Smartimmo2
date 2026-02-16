'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { SeverityLevel } from '../theme/severityColors';
import { cn } from '@/utils/cn';

export interface DashboardPriorityActionZoneProps {
  level: SeverityLevel;
  children: React.ReactNode;
  onActionGlobale?: () => void;
  /** Ligne micro-informative sous le titre (ex. "4 loyers en retard · 16 transactions à rapprocher") */
  summaryText?: string;
  className?: string;
}

/** Zone Actions prioritaires : conteneur 100 % neutre, gravité uniquement sur les cartes internes (ex. Loyers en retard). */
export function DashboardPriorityActionZone({
  level,
  children,
  onActionGlobale,
  summaryText,
  className,
}: DashboardPriorityActionZoneProps) {
  return (
    <motion.section
      id="dashboard-actions"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn('relative space-y-4', className)}
    >
      <div className="lg:sticky lg:top-20 lg:z-10 lg:bg-transparent lg:py-2 lg:-mx-1 lg:px-1 lg:border-b lg:border-slate-100 flex flex-wrap items-center justify-between gap-3 pb-2 lg:pb-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">Actions prioritaires</h2>
          {summaryText && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="mt-1 text-[13px] font-normal text-gray-500 leading-[1.4] opacity-90 max-w-full break-words sm:max-w-2xl"
            >
              {summaryText}
            </motion.p>
          )}
          <div className="h-1 w-10 bg-slate-400 rounded-full mt-2" />
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-6"
      >
        {children}
      </motion.div>
    </motion.section>
  );
}
