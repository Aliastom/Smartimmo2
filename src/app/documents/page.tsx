import { Suspense } from 'react';
import { DocumentsPageCore } from '@/features/documents/DocumentsPageCore';

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div>Chargement...</div>}>
        <DocumentsPageCore mode="normal" />
      </Suspense>
    </div>
  );
}
