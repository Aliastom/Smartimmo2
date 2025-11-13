'use client';

import React from 'react';
import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string;
  variant?: 'row' | 'card' | 'tile' | 'text' | 'circle';
  rounded?: boolean;
  shimmer?: boolean;
  children?: React.ReactNode;
}

export function Skeleton({ 
  className, 
  variant = 'row',
  rounded = true,
  shimmer = true,
  children 
}: SkeletonProps) {
  const baseClasses = 'bg-base-300/40 relative overflow-hidden';
  
  const variantClasses = {
    row: 'h-4 w-full',
    card: 'h-32 w-full',
    tile: 'h-24 w-24',
    text: 'h-4',
    circle: 'rounded-full w-8 h-8'
  };

  const roundedClasses = rounded && variant !== 'circle' ? 'rounded-lg' : '';
  
  const shimmerClasses = shimmer ? 'animate-shimmer' : '';

  return (
    <div className={cn(
      baseClasses,
      variantClasses[variant],
      roundedClasses,
      shimmerClasses,
      className
    )}>
      {shimmer && (
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent motion-reduce:animate-none" />
      )}
      {children}
    </div>
  );
}

// Composants de skeleton spécialisés
export function SkeletonText({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton 
          key={i} 
          variant="text" 
          className={i === lines - 1 ? 'w-3/4' : 'w-full'} 
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <Skeleton variant="card" className={cn('p-4', className)}>
      <div className="space-y-3">
        <Skeleton variant="text" className="w-1/2" />
        <SkeletonText lines={2} />
        <div className="flex justify-between items-center">
          <Skeleton variant="text" className="w-1/4" />
          <Skeleton variant="circle" />
        </div>
      </div>
    </Skeleton>
  );
}

export function SkeletonTable({ 
  rows = 5, 
  columns = 4, 
  className 
}: { 
  rows?: number; 
  columns?: number; 
  className?: string; 
}) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} variant="text" className="flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }, (_, j) => (
            <Skeleton key={j} variant="text" className="flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ 
  items = 3, 
  className 
}: { 
  items?: number; 
  className?: string; 
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton variant="circle" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-3/4" />
            <Skeleton variant="text" className="w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
