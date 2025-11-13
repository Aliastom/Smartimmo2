/**
 * Page de simulation fiscale
 */

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import SimulationClient from './SimulationClient';

export const metadata = {
  title: 'Simulation fiscale | SmartImmo',
  description: 'Calculez vos impôts immobiliers (IR, PS) et optimisez votre fiscalité',
};

export default function SimulationPage() {
  return (
    <Suspense fallback={<SimulationSkeleton />}>
      <SimulationClient />
    </Suspense>
  );
}

function SimulationSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-6 w-full max-w-2xl" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </div>
  );
}

