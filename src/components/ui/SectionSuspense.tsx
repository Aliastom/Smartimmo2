'use client';

import React, { Suspense } from 'react';
import { cn } from '@/utils/cn';
import { Skeleton, SkeletonCard, SkeletonTable, SkeletonList } from './Skeleton';

interface SectionSuspenseProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  fallbackType?: 'skeleton' | 'card' | 'table' | 'list' | 'custom';
  className?: string;
  skeletonProps?: {
    rows?: number;
    columns?: number;
    items?: number;
    variant?: 'row' | 'card' | 'tile' | 'text' | 'circle';
  };
}

export function SectionSuspense({ 
  children, 
  fallback,
  fallbackType = 'skeleton',
  className,
  skeletonProps = {}
}: SectionSuspenseProps) {
  // Si un fallback personnalisé est fourni, l'utiliser
  if (fallback) {
    return (
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    );
  }

  // Générer le fallback selon le type
  const generateFallback = () => {
    switch (fallbackType) {
      case 'card':
        return (
          <div className={cn('grid gap-4', className)}>
            {Array.from({ length: skeletonProps.items || 3 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        );

      case 'table':
        return (
          <div className={className}>
            <SkeletonTable 
              rows={skeletonProps.rows || 5}
              columns={skeletonProps.columns || 4}
            />
          </div>
        );

      case 'list':
        return (
          <div className={className}>
            <SkeletonList items={skeletonProps.items || 5} />
          </div>
        );

      case 'skeleton':
      default:
        return (
          <Skeleton 
            variant={skeletonProps.variant || 'card'}
            className={cn('h-32', className)}
          />
        );
    }
  };

  return (
    <Suspense fallback={generateFallback()}>
      {children}
    </Suspense>
  );
}

// Composants spécialisés pour différentes sections
export function DashboardSuspense({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <SectionSuspense
      fallbackType="card"
      skeletonProps={{ items: 4 }}
      className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}
    >
      {children}
    </SectionSuspense>
  );
}

export function TableSuspense({ 
  children, 
  rows = 8, 
  columns = 5,
  className 
}: { 
  children: React.ReactNode; 
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <SectionSuspense
      fallbackType="table"
      skeletonProps={{ rows, columns }}
      className={className}
    >
      {children}
    </SectionSuspense>
  );
}

export function ListSuspense({ 
  children, 
  items = 6,
  className 
}: { 
  children: React.ReactNode; 
  items?: number;
  className?: string;
}) {
  return (
    <SectionSuspense
      fallbackType="list"
      skeletonProps={{ items }}
      className={className}
    >
      {children}
    </SectionSuspense>
  );
}

export function ChartSuspense({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <SectionSuspense
      fallback={
        <div className={cn('bg-white rounded-lg border p-6', className)}>
          <div className="space-y-4">
            <Skeleton variant="text" className="w-1/3" />
            <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-gray-400 text-sm">Chargement du graphique...</div>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </SectionSuspense>
  );
}

export function CardGridSuspense({ 
  children, 
  columns = 3,
  items = 6,
  className 
}: { 
  children: React.ReactNode; 
  columns?: 2 | 3 | 4;
  items?: number;
  className?: string;
}) {
  const gridClasses = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
  };

  return (
    <SectionSuspense
      fallback={
        <div className={cn('grid gap-4', gridClasses[columns], className)}>
          {Array.from({ length: items }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      }
    >
      {children}
    </SectionSuspense>
  );
}
