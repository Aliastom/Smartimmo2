import { Suspense } from 'react';
import { DocumentsPageUnified } from '@/components/documents/DocumentsPageUnified';

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Chargement...</div>}>
        <DocumentsPageUnified />
      </Suspense>
    </div>
  );
}
