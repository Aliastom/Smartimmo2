'use client';

import React from 'react';
import { cn } from '@/utils/cn';
import { CloseButtonStandard } from './CloseButtonStandard';

export interface ModalHeaderStandardProps {
  title?: React.ReactNode;
  titleId?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
  closeAriaLabel?: string;
  className?: string;
  titleClassName?: string;
}

export function ModalHeaderStandard({
  title,
  titleId = 'modal-title',
  onClose,
  showCloseButton = true,
  closeAriaLabel = 'Fermer',
  className,
  titleClassName,
}: ModalHeaderStandardProps) {
  if (!title && !showCloseButton) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between p-4 md:p-6 border-b border-gray-200 flex-shrink-0 bg-white rounded-t-2xl overflow-hidden',
        className
      )}
    >
      {title && (
        <h2 id={titleId} className={cn('text-base md:text-lg font-semibold text-gray-900', titleClassName)}>
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

