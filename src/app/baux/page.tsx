import { Suspense } from 'react';
import LeasesClient from './LeasesClient';

export default function LeasesPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Chargement...</div>}>
        <LeasesClient />
      </Suspense>
    </div>
  );
}
