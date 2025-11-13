'use client';

import React, { useState } from 'react';
import { LucideIcon, Filter, ChevronRight } from 'lucide-react';
import { cn } from '@/utils/cn';

interface InsightChipProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  delta?: string; // Évolution (+5%, -2%)
  tooltip?: string;
  color?: 'success' | 'error' | 'warning' | 'info' | 'primary';
  highlight?: boolean;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  popoverContent?: React.ReactNode;
  className?: string;
}

const colorClasses = {
  success: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success/20',
    hover: 'hover:bg-success/20'
  },
  error: {
    bg: 'bg-error/10',
    text: 'text-error',
    border: 'border-error/20',
    hover: 'hover:bg-error/20'
  },
  warning: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning/20',
    hover: 'hover:bg-warning/20'
  },
  info: {
    bg: 'bg-info/10',
    text: 'text-info',
    border: 'border-info/20',
    hover: 'hover:bg-info/20'
  },
  primary: {
    bg: 'bg-primary/10',
    text: 'text-primary',
    border: 'border-primary/20',
    hover: 'hover:bg-primary/20'
  }
};

export function InsightChip({
  icon,
  label,
  value,
  delta,
  tooltip,
  color = 'primary',
  highlight = false,
  isActive = false,
  isDisabled = false,
  onClick,
  popoverContent,
  className
}: InsightChipProps) {
  const [showPopover, setShowPopover] = useState(false);
  const Icon = icon || Filter;
  const colors = colorClasses[color];
  const isClickable = !!onClick && !isDisabled;

  return (
    <div className="relative w-full">
      <div
        role="button"
        tabIndex={isClickable ? 0 : -1}
        aria-pressed={isActive}
        aria-label={tooltip || `Filtrer : ${label}`}
        title={tooltip || (isClickable ? `Filtrer : ${label}` : undefined)}
        className={cn(
          'relative h-11 md:h-10 w-full rounded-xl border bg-base-100 border-base-300 text-base-content/90',
          'flex items-center gap-2 px-3 shadow-sm transition-all duration-150 ease-out select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          !isActive && !isDisabled && isClickable && 'hover:-translate-y-[1px] hover:shadow-md hover:ring-1 hover:ring-base-300/70',
          // État actif avec indicateur gauche
          isActive && [
            'border-primary/50 bg-primary/5 text-primary',
            'before:content-[""] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary before:rounded-l'
          ],
          // État disabled
          isDisabled && 'opacity-50 pointer-events-none',
          // Highlight pour états critiques
          highlight && 'shadow-[0_0_0_3px] shadow-error/10',
          // Cursor
          isClickable && 'cursor-pointer',
          className
        )}
        onClick={isClickable ? onClick : undefined}
        onMouseEnter={() => setShowPopover(true)}
        onMouseLeave={() => setShowPopover(false)}
      >
        <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary/80' : 'text-base-content/60')} />
        
        <div className="flex flex-col flex-1 min-w-0">
          <span className={cn(
            'text-xs truncate',
            isActive ? 'text-primary/80' : 'text-base-content/70'
          )}>
            {label}
          </span>
          <div className="flex items-center gap-1">
            <span className={cn(
              'text-sm font-semibold truncate',
              isActive ? 'text-primary' : colors.text
            )}>
              {value}
            </span>
            {delta && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded shrink-0',
                isActive 
                  ? 'bg-primary/10 text-primary' 
                  : delta.startsWith('+') 
                    ? 'bg-success/10 text-success'
                    : 'bg-error/10 text-error'
              )}>
                {delta}
              </span>
            )}
          </div>
        </div>

        {isClickable && <ChevronRight className={cn('ml-auto h-4 w-4 shrink-0 opacity-60', isActive ? 'text-primary/80' : 'text-base-content/50')} />}
      </div>

      {/* Popover */}
      {popoverContent && showPopover && (
        <div className="absolute top-full left-0 mt-2 z-50 w-64 p-4 bg-base-100 rounded-lg shadow-lg border border-base-300">
          {popoverContent}
        </div>
      )}
    </div>
  );
}
