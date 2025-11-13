import { Suspense } from 'react';
import TransactionsClient from './TransactionsClient';

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Chargement...</div>}>
        <TransactionsClient />
      </Suspense>
    </div>
  );
}