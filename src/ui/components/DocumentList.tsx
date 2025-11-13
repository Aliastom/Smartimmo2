'use client';

import React from 'react';
import { File, Download, Trash2, Eye } from 'lucide-react';
import { Document, DocType } from '../../domain/entities/Document';

interface DocumentListProps {
  documents: Document[];
  onDelete?: (documentId: string) => void;
  onView?: (document: Document) => void;
  showActions?: boolean;
}

const getDocTypeIcon = (docType: DocType) => {
  switch (docType) {
    case 'invoice':
      return '📄';
    case 'receipt':
      return '🧾';
    case 'lease':
      return '📋';
    case 'loan':
      return '💰';
    case 'tax':
      return '📊';
    case 'photo':
      return '📷';
    default:
      return '📄';
  }
};

const getDocTypeLabel = (docType: DocType) => {
  switch (docType) {
    case 'invoice':
      return 'Facture';
    case 'receipt':
      return 'Reçu';
    case 'lease':
      return 'Bail';
    case 'loan':
      return 'Prêt';
    case 'tax':
      return 'Taxe';
    case 'photo':
      return 'Photo';
    default:
      return 'Autre';
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function DocumentList({ 
  documents, 
  onDelete, 
  onView, 
  showActions = true 
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-neutral-500">
        <File className="mx-auto h-12 w-12 text-neutral-300" />
        <p className="mt-2">Aucun document</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((document) => (
        <div key={document.id} className="flex items-center justify-between p-3 bg-base-100 border border-neutral-200 rounded-lg hover:bg-neutral-50">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getDocTypeIcon(document.docType)}</span>
            <div>
              <p className="text-sm font-medium text-neutral-900">{document.fileName}</p>
              <div className="flex items-center space-x-2 text-xs text-neutral-500">
                <span>{getDocTypeLabel(document.docType)}</span>
                <span>•</span>
                <span>{formatFileSize(document.size)}</span>
                <span>•</span>
                <span>{formatDate(document.createdAt)}</span>
              </div>
            </div>
          </div>
          
          {showActions && (
            <div className="flex items-center space-x-2">
              {onView && (
                <button
                  onClick={() => onView(document)}
                  className="text-primary-600 hover:text-primary-800 p-1"
                  title="Voir le document"
                >
                  <Eye className="h-4 w-4" />
                </button>
              )}
              <a
                href={document.url}
                download={document.fileName}
                className="text-success hover:text-green-800 p-1"
                title="Télécharger"
              >
                <Download className="h-4 w-4" />
              </a>
              {onDelete && (
                <button
                  onClick={() => onDelete(document.id)}
                  className="text-error hover:text-red-800 p-1"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
