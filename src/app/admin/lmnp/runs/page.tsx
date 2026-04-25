import { Suspense } from 'react';
import { Metadata } from 'next';
import LmnpRunsAdminClient from './LmnpRunsAdminClient';

export const metadata: Metadata = {
  title: 'Historique runs LMNP — Administration',
  description: "Consultation des runs d'export LMNP et du manifeste",
};

export default function LmnpRunsAdminPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Chargement…</div>}>
      <LmnpRunsAdminClient />
    </Suspense>
  );
}
