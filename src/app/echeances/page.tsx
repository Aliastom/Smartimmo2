import { Suspense } from 'react';
import { EcheancesPageCore } from '@/features/echeances/EcheancesPageCore';

export default function EcheancesPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <EcheancesPageCore mode="normal" />
    </Suspense>
  );
}
