'use client';

import React from 'react';
import { cn } from '@/utils/cn';

export interface SectionTitleProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  centerContent?: React.ReactNode;
  titleSuffix?: React.ReactNode;
  className?: string;
}

export function SectionTitle({ 
  title, 
  description, 
  actions,
  centerContent,
  titleSuffix,
  className 
}: SectionTitleProps) {
  return (
    <div className={cn("mb-4 sm:mb-6", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 w-full">
        {/* Titre à gauche */}
        <div className="flex items-center gap-4 flex-shrink-0 min-w-0">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{title}</h1>
            {description && (
              <p className="text-sm sm:text-base text-gray-600 mt-1">{description}</p>
            )}
          </div>
          {titleSuffix && (
            <div className="flex items-center flex-shrink-0">
              {titleSuffix}
            </div>
          )}
        </div>
        
        {/* Menu au centre */}
        {centerContent && (
          <div className="flex items-center justify-center flex-1 order-last sm:order-none">
            {centerContent}
          </div>
        )}
        
        {/* Actions à droite */}
        {actions && (
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
