import { Suspense } from 'react';
import { ParametresPageCore } from '@/features/parametres/ParametresPageCore';

export default function ParametresPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <ParametresPageCore mode="normal" />
    </Suspense>
  );
}
