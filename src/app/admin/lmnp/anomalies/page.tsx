import { Suspense } from 'react';
import { Metadata } from 'next';
import LmnpAnomaliesAdminClient from './LmnpAnomaliesAdminClient';

export const metadata: Metadata = {
  title: 'Anomalies export LMNP — Administration',
  description: "Consultation des anomalies et création d'overrides export LMNP",
};

export default function LmnpAnomaliesAdminPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-600">Chargement…</div>}>
      <LmnpAnomaliesAdminClient />
    </Suspense>
  );
}
