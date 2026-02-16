'use client';

import React from 'react';
import { cn } from '@/utils/cn';

export interface DashboardGlobalOverviewSectionProps {
  children: React.ReactNode;
  className?: string;
}

/** Section basse "Vue globale" : fond différencié, KPI et pilotage. */
export function DashboardGlobalOverviewSection({
  children,
  className,
}: DashboardGlobalOverviewSectionProps) {
  return (
    <section
      className={cn('relative rounded-2xl bg-slate-50 py-8', className)}
    >
      <div className="lg:sticky lg:top-20 lg:z-10 lg:bg-transparent lg:py-2 lg:-mx-0 lg:px-0 lg:mb-4 lg:border-b lg:border-slate-100">
        <h2 className="text-lg font-semibold text-slate-900">Vue globale</h2>
        <div className="h-1 w-10 bg-slate-400 rounded-full mt-2" />
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}
