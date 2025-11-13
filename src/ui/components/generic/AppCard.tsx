'use client';

import React from 'react';
import { 
  Card, 
  CardInteractive, 
  CardHover, 
  Surface, 
  SurfaceMuted,
  combineClasses 
} from '@/ui/tokens';

interface AppCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'interactive' | 'hover' | 'muted' | 'elevated';
  className?: string;
  onClick?: () => void;
  role?: string;
  'aria-label'?: string;
}

export function AppCard({ 
  children, 
  variant = 'default', 
  className = '', 
  onClick,
  role,
  'aria-label': ariaLabel 
}: AppCardProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'interactive':
        return CardInteractive;
      case 'hover':
        return CardHover;
      case 'muted':
        return SurfaceMuted;
      case 'elevated':
        return Surface;
      default:
        return Card;
    }
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      className={combineClasses(getVariantClasses(), className)}
      onClick={onClick}
      role={role}
      aria-label={ariaLabel}
    >
      {children}
    </Component>
  );
}
