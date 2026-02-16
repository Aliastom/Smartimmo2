'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { SeverityLevel } from '../theme/severityColors';
import { cn } from '@/utils/cn';

export interface GravityTimelineItem {
  month: string; // ex: "Janv", "Févr"
  level: SeverityLevel;
}

export interface GravityTimelineProps {
  items: GravityTimelineItem[];
  className?: string;
}

const LEVEL_COLORS: Record<SeverityLevel, string> = {
  critical: 'bg-red-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-500',
  neutral: 'bg-slate-400',
};

export function GravityTimeline({ items, className }: GravityTimelineProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex items-center gap-2', className)}
    >
      <span className="text-xs text-slate-500">Historique :</span>
      <div className="flex gap-1.5">
        {items.map((item, i) => (
          <motion.div
            key={item.month}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.3, ease: 'easeOut' }}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium',
              item.level === 'critical' && 'bg-red-50 text-red-700',
              item.level === 'warning' && 'bg-amber-50 text-amber-700',
              item.level === 'success' && 'bg-emerald-50 text-emerald-700',
              item.level === 'neutral' && 'bg-slate-100 text-slate-600'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', LEVEL_COLORS[item.level])} />
            {item.month}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
