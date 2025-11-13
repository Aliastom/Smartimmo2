'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { DocumentCard } from './DocumentCard';
import { DocumentVersionTimeline } from './DocumentVersionTimeline';
import { DocumentEditModal } from './DocumentEditModal';
import { DocumentTableRow } from './DocumentTable';
import { FileText, Image, History, Info } from 'lucide-react';

interface DocumentModalProps {
  document: DocumentTableRow & {
    url?: string;
    extractedText?: string;
    ocrConfidence?: number;
    version?: number;
    replacesDocumentId?: string;
    fields?: Array<{
      fieldName: string;
      valueText?: string;
      confidence?: number;
    }>;
    reminders?: Array<{
      id: string;
      title: string;
      dueDate: Date | string;
      status: string;
    }>;
  };
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export function DocumentModal({
  document,
  isOpen,
  onClose,
  onUpdate,
}: DocumentModalProps) {
  const [activeTab, setActiveTab] = useState('infos');
  const [showEditModal, setShowEditModal] = useState(false);

  const handleDownload = () => {
    if (document.url) {
      window.open(document.url, '_blank');
    }
  };

  const handleDelete = async () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) {
      try {
        await fetch(`/api/documents/${document.id}`, {
          method: 'DELETE',
        });
        onUpdate?.();
        onClose();
      } catch (error) {
        console.error('Error deleting document:', error);
        alert('Erreur lors de la suppression du document');
      }
    }
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };


  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={document.filenameOriginal}
      size="xl"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="infos" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            Informations
          </TabsTrigger>
          <TabsTrigger value="fichier" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Fichier
          </TabsTrigger>
          {document.version && document.version > 1 && (
            <TabsTrigger value="versions" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Versions
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="infos">
          <DocumentCard
            document={document}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onEdit={handleEdit}
            onViewVersions={() => setActiveTab('versions')}
          />
        </TabsContent>

        <TabsContent value="fichier">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Aperçu</h3>
            
            {/* Aperçu du fichier */}
            <div className="bg-gray-50 rounded-lg p-4">
              {document.mime.includes('pdf') && (
                <iframe
                  src={`/api/documents/${document.id}/file`}
                  className="w-full h-[600px] border-0 rounded"
                  title={document.filenameOriginal}
                />
              )}
              {document.mime.includes('image') && (
                <img
                  src={`/api/documents/${document.id}/file`}
                  alt={document.filenameOriginal}
                  className="max-w-full mx-auto rounded"
                />
              )}
              {!document.mime.includes('pdf') && !document.mime.includes('image') && (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Aperçu non disponible pour ce type de fichier</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Téléchargez le fichier pour le consulter
                  </p>
                </div>
              )}
            </div>

            {/* Texte extrait (OCR) */}
            {document.extractedText && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Texte extrait (OCR)</h4>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(document.extractedText || '');
                      alert('✅ Texte copié dans le presse-papiers');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    📋 Copier
                  </button>
                </div>
                <div className="p-4 bg-gray-50 rounded text-sm text-gray-700 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono border">
                  {document.extractedText}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {document.version && document.version > 1 && (
          <TabsContent value="versions">
            <DocumentVersionTimeline
              currentDocumentId={document.id}
              replacesDocumentId={document.replacesDocumentId}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Modale d'édition */}
      <DocumentEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        document={document}
        onUpdate={onUpdate}
      />
    </Modal>
  );
}

