'use client';

import React from 'react';
import { cn } from '@/utils/cn';

export interface ActionFooterStandardProps {
  secondaryAction?: React.ReactNode;
  primaryAction?: React.ReactNode;
  dangerAction?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  stickyMobile?: boolean;
}

export function ActionFooterStandard({
  secondaryAction,
  primaryAction,
  dangerAction,
  children,
  className,
  stickyMobile = false,
}: ActionFooterStandardProps) {
  const hasPresetActions = Boolean(secondaryAction || primaryAction || dangerAction);

  return (
    <div
      className={cn(
        'border-t border-gray-200 bg-white',
        stickyMobile && 'fixed bottom-0 left-0 right-0 z-20 shadow-lg md:static md:shadow-none',
        className
      )}
      style={stickyMobile ? { paddingBottom: 'max(16px, env(safe-area-inset-bottom))' } : undefined}
    >
      {hasPresetActions ? (
        <div className="flex flex-col sm:flex-row justify-between gap-3 p-4 md:p-6">
          <div className="flex items-center gap-2">
            {dangerAction}
            {secondaryAction}
          </div>
          <div className="flex items-center gap-2">
            {primaryAction}
          </div>
        </div>
      ) : (
        <div className="p-4 md:p-6">{children}</div>
      )}
    </div>
  );
}

