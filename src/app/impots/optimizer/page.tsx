/**
 * Page d'optimisation fiscale
 */

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import OptimizerClient from './OptimizerClient';

export const metadata = {
  title: 'Optimisation fiscale | SmartImmo',
  description: 'Comparez les stratégies PER et travaux pour optimiser votre fiscalité immobilière',
};

export default function OptimizerPage() {
  return (
    <Suspense fallback={<OptimizerSkeleton />}>
      <OptimizerClient />
    </Suspense>
  );
}

function OptimizerSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-6 w-full max-w-2xl" />
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      
      <Skeleton className="h-96" />
      <Skeleton className="h-64" />
    </div>
  );
}

