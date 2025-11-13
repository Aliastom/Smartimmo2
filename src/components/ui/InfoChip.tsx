'use client';

import React from 'react';
import { LucideIcon, Info, CheckCircle, Calendar, Euro } from 'lucide-react';
import { cn } from '@/utils/cn';

interface InfoChipProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  tone?: 'neutral' | 'success' | 'warning' | 'error';
  tooltip?: string;
  className?: string;
}

const toneClasses = {
  neutral: 'border-base-200 text-base-content/70 bg-base-100',
  success: 'border-success/30 bg-success/5 text-success',
  warning: 'border-warning/30 bg-warning/5 text-warning',
  error: 'border-error/30 bg-error/5 text-error'
};

export function InfoChip({ icon, label, value, tone = 'neutral', tooltip, className }: InfoChipProps) {
  const Icon = icon || Info;
  return (
    <div
      role="status"
      aria-live="polite"
      title={tooltip}
      className={cn(
        'h-11 md:h-10 w-full rounded-xl border',
        'flex items-center gap-2 px-3 shadow-sm select-none cursor-default',
        toneClasses[tone],
        className
      )}
    >
      <Icon className={cn(
        'h-[18px] w-[18px] shrink-0', 
        tone === 'neutral' ? 'opacity-70' : 'opacity-80'
      )} />
      <div className="flex flex-col flex-1 min-w-0">
        <span className={cn(
          'text-xs truncate',
          tone === 'neutral' ? 'text-base-content/60' : 'opacity-80'
        )}>
          {label}
        </span>
        <span className={cn(
          'text-sm font-semibold truncate',
          tone === 'neutral' ? 'text-base-content/90' : ''
        )}>
          {value}
        </span>
      </div>
    </div>
  );
}


