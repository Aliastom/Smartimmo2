import { Suspense } from 'react';
import { PatrimoinePageCore } from '@/features/patrimoine/PatrimoinePageCore';

export default function PatrimoinePage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <PatrimoinePageCore mode="normal" />
    </Suspense>
  );
}
