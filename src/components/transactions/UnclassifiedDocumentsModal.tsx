'use client';

import React from 'react';
import { AlertTriangle, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface UnclassifiedDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  documents: Array<{
    id: string;
    fileName: string;
    status: string;
  }>;
}

export function UnclassifiedDocumentsModal({
  isOpen,
  onClose,
  onConfirm,
  documents
}: UnclassifiedDocumentsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Documents non classés
            </h3>
            <p className="text-sm text-gray-600">
              {documents.length} document{documents.length > 1 ? 's' : ''} non classé{documents.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Message */}
        <div className="mb-4">
          <p className="text-gray-700">
            Un ou plusieurs documents ne sont pas classés. Êtes-vous sûr de vouloir continuer ?
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Les documents non classés peuvent être classifiés plus tard depuis la page Documents.
          </p>
        </div>

        {/* Liste des documents */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Documents concernés :</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {doc.fileName}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                  Non classé
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-orange-600 hover:bg-orange-700"
          >
            Continuer quand même
          </Button>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
