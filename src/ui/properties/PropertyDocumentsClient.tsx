'use client';

import React, { useState, useEffect } from 'react';
import { Property } from '../../domain/entities/Property';
import { Document } from '../../domain/entities/Document';
import { Upload, Plus } from 'lucide-react';
import { Button } from '@/ui/shared/button';
import { useToast } from '../../hooks/useToast';
import DocumentsTable from '../tables/DocumentsTable';
import DocumentStatsCards from '../components/stats/DocumentStatsCards';
import { useDocuments, useCreateDocument, useDeleteDocument, useDocumentTypes } from '@/hooks/useDocuments';
import { useQueryClient } from '@tanstack/react-query';
import { UploadDocumentModal } from '@/ui/documents/UploadDocumentModal';

interface PropertyDocumentsClientProps {
  property: Property;
}

// Les types de documents seront récupérés depuis la base de données

export default function PropertyDocumentsClient({ property }: PropertyDocumentsClientProps) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    documentTypeId: '',
    q: '',
  });
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // Récupérer les types de documents depuis la base de données
  const { data: documentTypes = [], isLoading: documentTypesLoading } = useDocumentTypes();

  // Fonction pour ouvrir la modal avec invalidation du cache
  const handleOpenUploadModal = () => {
    // Forcer l'invalidation du cache des types de documents
    queryClient.invalidateQueries({ queryKey: ['documentTypes'] });
    setIsUploadModalOpen(true);
  };

  // Utiliser les hooks React Query
  const { data: documentsResponse, isLoading: loading } = useDocuments({
    propertyId: property.id,
    documentTypeId: filters.documentTypeId || undefined,
    q: filters.q || undefined,
  });
  
  const documents = documentsResponse?.items || [];
  const createDocument = useCreateDocument();
  const deleteDocument = useDeleteDocument();

  const handleUploadSuccess = () => {
    setIsUploadModalOpen(false);
    // La liste sera automatiquement rafraîchie grâce à l'invalidation des queries
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Confirmer la suppression de ce document ?')) return;

    try {
      await deleteDocument.mutateAsync(id);
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header avec bouton CTA */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-bold text-neutral-900">Documents</h3>
          <p className="text-neutral-600 mt-1">
            {documents.length} document{documents.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <DocumentStatsCards propertyId={property.id} />

      {/* Filtres */}
      <div className="bg-base-100 rounded-lg shadow-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Type de document
            </label>
            <select
              value={filters.documentTypeId}
              onChange={(e) => setFilters(prev => ({ ...prev, documentTypeId: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            >
              <option value="">Tous les types</option>
              {documentTypes.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Recherche
            </label>
            <input
              type="text"
              placeholder="Nom du fichier..."
              value={filters.q}
              onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value }))}
              className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* Bouton d'ajout de document */}
      <div className="bg-base-100 rounded-lg shadow-card p-6">
        <div className="flex items-center justify-center">
          <Button
            onClick={handleOpenUploadModal}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Ajouter un document
          </Button>
        </div>
      </div>

      {/* Liste des documents */}
      <DocumentsTable
        documents={documents}
        loading={loading}
        context="property"
        showPropertyColumn={false}
        onDelete={handleDelete}
      />

      {/* Modal d'upload de document */}
      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        documentTypes={documentTypes}
        propertyId={property.id}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}

