'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Eye, X } from 'lucide-react';
import { Property } from '../../domain/entities/Property';
import { Document } from '../../domain/entities/Document';
import FormModal from './FormModal';
import DocumentUploadForm from './DocumentUploadForm';
import ActionButtons from './ActionButtons';
import { formatBytes, formatDateShort } from '@/utils/format';
import { useToast } from '../../hooks/useToast';
import { useRouter } from 'next/navigation';

interface PropertyPhotosTabProps {
  property: Property;
  documents: Document[];
  onUpdate: () => void;
}

const DOC_TYPES = [
  { value: 'photo', label: 'Photo' },
];

export default function PropertyPhotosTab({ property, documents, onUpdate }: PropertyPhotosTabProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Document | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const { showSuccess, showError } = useToast();
  const router = useRouter();

  // Reset active photo index when documents change
  useEffect(() => {
    if (documents.length > 0 && activePhotoIndex >= documents.length) {
      setActivePhotoIndex(0);
    }
  }, [documents.length, activePhotoIndex]);

  const activePhoto = documents[activePhotoIndex];

  const handleUploadDocuments = async () => {
    // La logique d'upload est gérée dans DocumentUploadForm
    showSuccess('Photos uploadées', 'Les photos ont été uploadées avec succès');
    onUpdate();
    setIsModalOpen(false);
    router.refresh();
  };

  const handleDeletePhoto = async (documentId: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette photo ?')) {
      try {
        const response = await fetch(`/api/documents/${documentId}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          showSuccess('Photo supprimée', 'La photo a été supprimée avec succès');
          onUpdate();
          router.refresh();
        } else {
          showError('Erreur', 'Erreur lors de la suppression de la photo');
        }
      } catch (error) {
        console.error('Delete error:', error);
        showError('Erreur', 'Une erreur inattendue est survenue');
      }
    }
  };

  const handleDownloadPhoto = (document: Document) => {
    const link = window.Document.createElement('a');
    link.href = document.url;
    link.download = document.fileName;
    link.click();
  };

  const handleViewPhoto = (document: Document) => {
    setSelectedPhoto(document);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-neutral-900">
          Photos ({documents.length})
        </h3>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 px-3 py-2 bg-primary text-base-100 rounded-md hover:bg-primary transition"
        >
          <Plus className="h-4 w-4" />
          <span>Ajouter des photos</span>
        </button>
      </div>

      {/* Photos Slider */}
      {documents.length > 0 ? (
        <div className="space-y-4">
          {/* Main Photo Display */}
          <div className="relative bg-base-100 border border-neutral-200 rounded-lg overflow-hidden">
            <div className="aspect-video bg-neutral-100 flex items-center justify-center">
              {activePhoto?.mime.startsWith('image/') ? (
                <img
                  src={activePhoto.url}
                  alt={activePhoto.fileName}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => handleViewPhoto(activePhoto)}
                />
              ) : (
                <div className="text-center p-8">
                  <Eye className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
                  <p className="text-neutral-500">Aperçu non disponible</p>
                </div>
              )}
            </div>
            
            {/* Navigation arrows */}
            {documents.length > 1 && (
              <>
                <button
                  onClick={() => setActivePhotoIndex(prev => prev > 0 ? prev - 1 : documents.length - 1)}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 p-2 bg-base-content bg-opacity-50 text-base-100 rounded-full hover:bg-opacity-75 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setActivePhotoIndex(prev => prev < documents.length - 1 ? prev + 1 : 0)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 bg-base-content bg-opacity-50 text-base-100 rounded-full hover:bg-opacity-75 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
            
            {/* Actions for main photo */}
            <div className="absolute top-4 right-4">
              <ActionButtons
                onView={() => handleViewPhoto(activePhoto)}
                onDownload={() => handleDownloadPhoto(activePhoto)}
                onDelete={() => handleDeletePhoto(activePhoto.id)}
                showView={true}
                showDownload={true}
              />
            </div>
            
            {/* Photo Info */}
            <div className="p-4 border-t border-neutral-200">
              <p className="text-sm font-medium text-neutral-900" title={activePhoto.fileName}>
                {activePhoto.fileName}
              </p>
              <p className="text-xs text-neutral-500">
                {formatBytes(activePhoto.size)} • {formatDateShort(activePhoto.createdAt)}
              </p>
              {documents.length > 1 && (
                <p className="text-xs text-neutral-400 mt-1">
                  {activePhotoIndex + 1} / {documents.length}
                </p>
              )}
            </div>
          </div>

          {/* Thumbnail Strip */}
          {documents.length > 1 && (
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {documents.map((document, index) => (
                <div 
                  key={document.id} 
                  className={`flex-shrink-0 w-20 h-20 bg-base-100 border rounded-lg overflow-hidden cursor-pointer transition ${
                    index === activePhotoIndex 
                      ? 'border-primary ring-2 ring-blue-200' 
                      : 'border-neutral-200 hover:border-primary'
                  }`}
                  onClick={() => setActivePhotoIndex(index)}
                >
                  {document.mime.startsWith('image/') ? (
                    <img
                      src={document.url}
                      alt={document.fileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-100">
                      <Eye className="h-6 w-6 text-neutral-400" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-neutral-50 rounded-lg border border-neutral-200">
          <Eye className="h-12 w-12 text-neutral-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-neutral-900 mb-2">Aucune photo</h4>
          <p className="text-neutral-600">Ajoutez des photos pour documenter ce bien</p>
        </div>
      )}

      {/* Upload Modal */}
      <FormModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Ajouter des photos"
      >
        <DocumentUploadForm 
          properties={[property]}
          transactions={[]}
          docTypes={DOC_TYPES}
          onUpload={handleUploadDocuments}
          onCancel={() => setIsModalOpen(false)}
          lockedPropertyId={property.id}
          defaultDocType="photo"
        />
      </FormModal>

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-base-content bg-opacity-90 flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 p-2 bg-base-content bg-opacity-50 text-base-100 rounded-full hover:bg-opacity-75 transition"
            >
              <X className="h-6 w-6" />
            </button>
            <img
              src={selectedPhoto.url}
              alt={selectedPhoto.fileName}
              className="max-w-full max-h-full object-contain"
            />
            <div className="absolute bottom-4 left-4 right-4 bg-base-content bg-opacity-50 text-base-100 p-4 rounded-lg">
              <p className="font-medium">{selectedPhoto.fileName}</p>
              <p className="text-sm opacity-75">
                {formatBytes(selectedPhoto.size)} • {formatDateShort(selectedPhoto.createdAt)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
