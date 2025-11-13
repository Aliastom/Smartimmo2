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
    <div className={cn("mb-6", className)}>
      <div className="flex items-center justify-between gap-6 w-full">
        {/* Titre à gauche */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            {description && (
              <p className="text-gray-600 mt-1">{description}</p>
            )}
          </div>
          {titleSuffix && (
            <div className="flex items-center">
              {titleSuffix}
            </div>
          )}
        </div>
        
        {/* Menu au centre */}
        {centerContent && (
          <div className="flex items-center justify-center flex-1">
            {centerContent}
          </div>
        )}
        
        {/* Actions à droite */}
        {actions && (
          <div className="flex items-center gap-3 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
