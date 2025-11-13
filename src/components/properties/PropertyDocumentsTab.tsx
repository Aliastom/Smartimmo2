/**
 * Onglet Documents pour un Bien immobilier
 * Utilise DocumentsListUnified avec préfiltrage sur PROPERTY
 */

import { useState } from 'react';
import { DocumentsListUnified } from '@/components/documents/DocumentsListUnified';
import { ContextSelector } from '@/components/documents/ContextSelector';
import { Button } from '@/ui/shared/button';
import { Upload, Plus } from 'lucide-react';
import { DocumentContext } from '@/types/document-link';

interface PropertyDocumentsTabProps {
  propertyId: string;
  propertyName?: string;
}

export function PropertyDocumentsTab({ propertyId, propertyName }: PropertyDocumentsTabProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Contexte préfiltré sur ce bien
  const context: DocumentContext = {
    entityType: 'PROPERTY',
    entityId: propertyId,
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleUpload = () => {
    // TODO: Ouvrir la modale d'upload avec le contexte pré-rempli
    setShowUploadModal(true);
    alert('Fonctionnalité d\'upload à intégrer avec UploadReviewModal');
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Documents du bien
          </h2>
          {propertyName && (
            <p className="mt-1 text-sm text-gray-600">
              {propertyName}
            </p>
          )}
        </div>

        <Button onClick={handleUpload} className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Ajouter des documents
        </Button>
      </div>

      {/* Indication du contexte actuel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Contexte actuel :</strong> Les documents affichés ci-dessous sont rattachés à ce bien immobilier.
        </p>
      </div>

      {/* Liste des documents */}
      <DocumentsListUnified
        key={refreshKey}
        context={context}
        showContextColumn={true}
        showActions={true}
        onDocumentUpdate={handleRefresh}
        onDocumentDelete={handleRefresh}
      />
    </div>
  );
}

