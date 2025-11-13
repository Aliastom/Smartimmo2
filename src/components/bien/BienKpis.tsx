'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { KPICard } from '@/components/ui/KPICard';
import { cn } from '@/utils/cn';

export interface BienKpi {
  title: string;
  value: string | number;
  iconName: string;
  trend?: {
    value: number;
    label: string;
    period?: string;
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
}

export interface BienKpisProps {
  kpis: BienKpi[];
  loading?: boolean;
  className?: string;
}

export function BienKpis({ kpis, loading = false, className }: BienKpisProps) {
  if (loading) {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4', className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4', className)}
    >
      {kpis.map((kpi, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + index * 0.05 }}
        >
          <KPICard
            title={kpi.title}
            value={kpi.value}
            iconName={kpi.iconName}
            trend={kpi.trend}
            color={kpi.color}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

