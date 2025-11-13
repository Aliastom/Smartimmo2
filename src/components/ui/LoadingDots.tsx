'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface LoadingDotsProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray' | 'current';
}

export function LoadingDots({ 
  className, 
  size = 'md',
  color = 'current'
}: LoadingDotsProps) {
  const sizeClasses = {
    sm: 'w-1 h-1',
    md: 'w-1.5 h-1.5', 
    lg: 'w-2 h-2'
  };

  const colorClasses = {
    primary: 'bg-primary',
    white: 'bg-white',
    gray: 'bg-gray-400',
    current: 'bg-current'
  };

  const gapClasses = {
    sm: 'gap-0.5',
    md: 'gap-1',
    lg: 'gap-1.5'
  };

  return (
    <div className={cn('flex items-center', gapClasses[size], className)}>
      <div 
        className={cn(
          'rounded-full animate-bounce motion-reduce:animate-pulse',
          sizeClasses[size],
          colorClasses[color]
        )}
        style={{ animationDelay: '0ms' }}
      />
      <div 
        className={cn(
          'rounded-full animate-bounce motion-reduce:animate-pulse',
          sizeClasses[size],
          colorClasses[color]
        )}
        style={{ animationDelay: '150ms' }}
      />
      <div 
        className={cn(
          'rounded-full animate-bounce motion-reduce:animate-pulse',
          sizeClasses[size],
          colorClasses[color]
        )}
        style={{ animationDelay: '300ms' }}
      />
    </div>
  );
}

// Composant spécialisé pour les boutons
export function LoadingButton({ 
  children, 
  isLoading = false, 
  loadingText = "Traitement",
  className,
  disabled,
  ...props 
}: {
  children: React.ReactNode;
  isLoading?: boolean;
  loadingText?: string;
  className?: string;
  disabled?: boolean;
  [key: string]: any;
}) {
  return (
    <button
      className={cn(
        'btn',
        isLoading && 'btn-disabled',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          {loadingText}
          <LoadingDots size="sm" color="current" />
        </span>
      ) : (
        children
      )}
    </button>
  );
}

// Variante avec texte inline
export function InlineLoading({ 
  text = "Chargement", 
  className 
}: { 
  text?: string; 
  className?: string; 
}) {
  return (
    <span className={cn('flex items-center gap-2 text-sm text-gray-600', className)}>
      {text}
      <LoadingDots size="sm" color="gray" />
    </span>
  );
}
