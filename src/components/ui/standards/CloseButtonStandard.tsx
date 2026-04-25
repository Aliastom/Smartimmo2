'use client';

import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface CloseButtonStandardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel?: string;
  size?: 'sm' | 'md';
}

export function CloseButtonStandard({
  ariaLabel = 'Fermer',
  size = 'md',
  className,
  ...props
}: CloseButtonStandardProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        'text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors focus-ring',
        size === 'sm' ? 'p-1.5' : 'p-2',
        className
      )}
      {...props}
    >
      <X className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
    </button>
  );
}

