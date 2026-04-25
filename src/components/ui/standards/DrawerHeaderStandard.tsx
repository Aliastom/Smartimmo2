'use client';

import React from 'react';
import { cn } from '@/utils/cn';
import { CloseButtonStandard } from './CloseButtonStandard';

export interface DrawerHeaderStandardProps {
  title?: React.ReactNode;
  titleId?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
  closeAriaLabel?: string;
  className?: string;
  titleClassName?: string;
}

export function DrawerHeaderStandard({
  title,
  titleId = 'drawer-title',
  onClose,
  showCloseButton = true,
  closeAriaLabel = 'Fermer',
  className,
  titleClassName,
}: DrawerHeaderStandardProps) {
  if (!title && !showCloseButton) {
    return null;
  }

  return (
    <div className={cn('flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0', className)}>
      {title && (
        <h2 id={titleId} className={cn('text-lg font-semibold text-gray-900', titleClassName)}>
          {title}
        </h2>
      )}
      {showCloseButton && onClose && (
        <CloseButtonStandard
          onClick={onClose}
          ariaLabel={closeAriaLabel}
        />
      )}
    </div>
  );
}

