import { Suspense } from 'react';
import LoansClient from './LoansClient';

export default function LoansPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Chargement...</div>}>
        <LoansClient />
      </Suspense>
    </div>
  );
}
