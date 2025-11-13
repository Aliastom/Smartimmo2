import React from 'react';
import { cn } from '@/utils/cn';

interface IconProps {
  variant?: 'default' | 'muted' | 'accent' | 'success' | 'warning' | 'error';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  children: React.ReactNode;
}

const variantClasses = {
  default: 'text-base-content opacity-70',
  muted: 'text-base-content opacity-50',
  accent: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

const sizeClasses = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

export function Icon({ 
  variant = 'default',
  size = 'md',
  className = '', 
  children 
}: IconProps) {
  const variantClass = variantClasses[variant];
  const sizeClass = sizeClasses[size];
  
  return (
    <div 
      className={cn(
        'flex items-center justify-center',
        sizeClass,
        variantClass,
        className
      )}
    >
      {children}
    </div>
  );
}

// Composant pour les icônes avec pastille colorée
interface IconWithBadgeProps extends IconProps {
  badgeColor?: 'primary' | 'success' | 'warning' | 'error';
  badgeSize?: 'sm' | 'md';
}

export function IconWithBadge({ 
  variant = 'accent',
  badgeColor = 'primary',
  badgeSize = 'sm',
  className = '',
  children 
}: IconWithBadgeProps) {
  const badgeSizeClass = badgeSize === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const badgeColorClasses = {
    primary: 'bg-primary',
    success: 'bg-success', 
    warning: 'bg-warning',
    error: 'bg-error',
  };
  const badgeColorClass = badgeColorClasses[badgeColor];
  
  return (
    <div className={cn(
      'rounded-lg flex items-center justify-center',
      badgeSizeClass,
      badgeColorClass,
      'opacity-10 hover:opacity-20 transition-opacity duration-150',
      className
    )}>
      <Icon variant={variant} size="sm">
        {children}
      </Icon>
    </div>
  );
}
