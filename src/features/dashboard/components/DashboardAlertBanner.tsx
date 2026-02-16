'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { SeverityLevel } from '../theme/severityColors';
import type { DashboardAnomaly } from '../utils/dashboardGravity';
import { cn } from '@/utils/cn';

export interface DashboardAlertBannerProps {
  level: SeverityLevel;
  anomalies: DashboardAnomaly[];
  totalCount?: number;
  className?: string;
}

/** Bloc neutre "Problèmes actifs" : fond blanc, bordure slate, pills horizontales. Aucun rouge. */
export function DashboardAlertBanner({
  anomalies,
  totalCount,
  className,
}: DashboardAlertBannerProps) {
  const count = totalCount ?? anomalies.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-5 shadow-sm',
        className
      )}
    >
      <h3 className="text-base font-medium text-slate-800">
        Problèmes actifs
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        {count === 0
          ? 'Aucun élément à traiter'
          : `${count} élément${count > 1 ? 's' : ''} nécessitent votre attention`}
      </p>
      {anomalies.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {anomalies.slice(0, 8).map((a) => (
            <li key={a.id}>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                {a.detail ?? a.label}
              </span>
            </li>
          ))}
          {anomalies.length > 8 && (
            <li>
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                +{anomalies.length - 8} autre{anomalies.length - 8 > 1 ? 's' : ''}
              </span>
            </li>
          )}
        </ul>
      )}
    </motion.div>
  );
}
