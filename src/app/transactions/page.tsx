import { Suspense } from 'react';
import { TransactionsPageCore } from '@/features/transactions/TransactionsPageCore';

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Chargement...</div>}>
        <TransactionsPageCore mode="normal" />
      </Suspense>
    </div>
  );
}