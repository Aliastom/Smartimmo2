/**
 * Page admin - Paramètres fiscaux
 */

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import ParametresClient from './ParametresClient';

export const metadata = {
  title: 'Paramètres fiscaux | Admin | SmartImmo',
  description: 'Gestion des barèmes fiscaux et mise à jour automatique',
};

export default function ParametresPage() {
  return (
    <Suspense fallback={<ParametresSkeleton />}>
      <ParametresClient />
    </Suspense>
  );
}

function ParametresSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-6 w-full max-w-2xl" />
      </div>
      
      <Skeleton className="h-96" />
    </div>
  );
}

