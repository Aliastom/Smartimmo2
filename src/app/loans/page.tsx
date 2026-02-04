import { Suspense } from 'react';
import { LoansPageCore } from '@/features/loans/LoansPageCore';

export default function LoansPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Chargement...</div>}>
        <LoansPageCore mode="normal" />
      </Suspense>
    </div>
  );
}
