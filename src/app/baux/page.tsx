import { Suspense } from 'react';
import { LeasesPageCore } from '@/features/leases/LeasesPageCore';

export default function LeasesPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Chargement...</div>}>
        <LeasesPageCore mode="normal" />
      </Suspense>
    </div>
  );
}
