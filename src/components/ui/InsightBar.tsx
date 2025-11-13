'use client';

import React from 'react';
import { InsightChip } from './InsightChip';
import { cn } from '@/utils/cn';

interface InsightBarProps {
  children: React.ReactNode;
  className?: string;
}

export function InsightBar({ children, className }: InsightBarProps) {
  return (
    <div className={cn(
      'w-full sticky top-0 z-10',
      'bg-base-100/80 backdrop-blur supports-[backdrop-filter]:bg-base-100/70',
      'border-b border-base-300',
      'p-4',
      className
    )}>
      <div className={cn(
        'w-full grid gap-2 md:gap-3',
        // Grille fluide avec auto-fit et max 6 chips par ligne
        'grid-cols-[repeat(auto-fit,minmax(180px,1fr))]',
        // Auto-dimensionnement responsive
        'items-center'
      )}>
        {children}
      </div>
    </div>
  );
}

// Composant helper pour créer des chips facilement
export function createInsightChip(props: Parameters<typeof InsightChip>[0]) {
  return <InsightChip {...props} />;
}
