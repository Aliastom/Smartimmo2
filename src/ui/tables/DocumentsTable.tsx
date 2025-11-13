'use client';

import React from 'react';
import { Download, Trash2, Eye, FileText } from 'lucide-react';
import { Document, DocumentType } from '../../domain/entities/Document';
import { formatDateFR } from '@/utils/format';
import { getIcon } from '@/utils/icons';

interface DocumentsTableProps {
  documents: (Document & { documentType?: DocumentType })[];
  loading?: boolean;
  context?: 'global' | 'property';
  onView?: (document: Document) => void;
  onDownload?: (document: Document) => void;
  onDelete?: (id: string) => void;
  showPropertyColumn?: boolean;
  getPropertyName?: (propertyId?: string) => string;
}

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function DocumentsTable({
  documents,
  loading = false,
  context = 'global',
  onView,
  onDownload,
  onDelete,
  showPropertyColumn = true,
  getPropertyName,
}: DocumentsTableProps) {

  if (loading) {
    return (
      <div className="bg-base-100 rounded-lg shadow-card p-6">
        <p className="text-neutral-500">Chargement...</p>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="bg-base-100 rounded-lg shadow-card p-6">
        <div className="text-center py-8">
          <FileText size={48} className="mx-auto text-neutral-300 mb-4" />
          <p className="text-neutral-500 text-lg font-medium">Aucun document</p>
          <p className="text-neutral-400 text-sm mt-2">
            {context === 'property' 
              ? 'Aucun document pour ce bien'
              : 'Aucun document trouvé'
            }
          </p>
        </div>
      </div>
    );
  }

  const handleDownload = (document: Document) => {
    if (onDownload) {
      onDownload(document);
    } else {
      const link = window.Document.createElement('a');
      link.href = document.url;
      link.download = document.fileName || document.title;
      link.click();
    }
  };

  return (
    <div className="bg-base-100 rounded-lg shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Nom du fichier
              </th>
              {showPropertyColumn && (
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Bien associé
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Taille
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {documents.map((document) => {
              // Utiliser le nouveau système de types de documents
              const documentType = document.DocumentType;
              const IconComponent = documentType ? getIcon(documentType.icon) : FileText;
              
              return (
                <tr key={document.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <IconComponent className="h-5 w-5 text-base-content opacity-70" />
                      <span className="text-sm font-medium text-neutral-900">
                        {documentType?.label || 'Autre'}
                      </span>
                      {documentType?.isSystem && (
                        <span className="text-xs text-primary bg-blue-50 px-1 py-0.5 rounded">
                          Système
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-900">
                    {document.title || document.fileName || 'Sans nom'}
                  </td>
                  {showPropertyColumn && (
                    <td className="px-4 py-3 text-sm text-neutral-600">
                      {getPropertyName ? getPropertyName(document.propertyId) : (document.propertyId || 'Non associé')}
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {formatFileSize(document.size || 0)}
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600 whitespace-nowrap">
                    {formatDateFR(document.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center space-x-2">
                      {onView && (
                        <button
                          onClick={() => onView(document)}
                          className="text-primary hover:text-blue-800 transition-colors"
                          title="Voir"
                        >
                          <Eye size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(document)}
                        className="text-success hover:text-green-800 transition-colors"
                        title="Télécharger"
                      >
                        <Download size={16} />
                      </button>
                      {onDelete && (
                        <button
                          onClick={() => onDelete(document.id)}
                          className="text-error hover:text-red-800 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

