'use client';

import React from 'react';
import { X, Edit, Trash2, FileText, Download, Link as LinkIcon, CheckCircle, AlertCircle, Image as ImageIcon, File } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DocumentDrawerProps {
  document: {
    id: string;
    fileName: string;
    filenameOriginal: string;
    documentType?: {
      id: string;
      label: string;
      code: string;
    };
    status: string;
    size: number;
    mime: string;
    createdAt: Date | string;
    links?: Array<{
      id: string;
      linkedType: string;
      linkedId?: string;
      entityName?: string;
      role?: string;
    }>;
    ocrStatus?: string;
    extractedText?: string;
    ocrConfidence?: number;
    deletedAt?: Date | string | null;
    userReason?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (document: any) => void;
  onDownload: (document: any) => void;
}

export default function DocumentDrawer({
  document,
  isOpen,
  onClose,
  onDelete,
  onDownload
}: DocumentDrawerProps) {
  if (!isOpen || !document) return null;

  const formatDate = (dateString: string | Date): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getDocumentIcon = (mime: string) => {
    // PDF
    if (mime.includes('pdf')) {
      return (
        <div className="relative">
          <FileText className="h-16 w-16 text-red-500" />
          <span className="absolute bottom-0 right-0 text-[10px] font-bold text-red-600 bg-red-100 px-1 rounded">PDF</span>
        </div>
      );
    }
    
    // Images
    if (mime.includes('image')) {
      return (
        <div className="relative">
          <ImageIcon className="h-16 w-16 text-blue-500" />
          <span className="absolute bottom-0 right-0 text-[10px] font-bold text-blue-600 bg-blue-100 px-1 rounded">IMG</span>
        </div>
      );
    }
    
    // Documents Word
    if (mime.includes('word') || mime.includes('msword') || mime.includes('officedocument.wordprocessing')) {
      return (
        <div className="relative">
          <FileText className="h-16 w-16 text-blue-600" />
          <span className="absolute bottom-0 right-0 text-[10px] font-bold text-blue-600 bg-blue-100 px-1 rounded">DOC</span>
        </div>
      );
    }
    
    // Excel
    if (mime.includes('excel') || mime.includes('spreadsheet')) {
      return (
        <div className="relative">
          <FileText className="h-16 w-16 text-green-600" />
          <span className="absolute bottom-0 right-0 text-[10px] font-bold text-green-600 bg-green-100 px-1 rounded">XLS</span>
        </div>
      );
    }
    
    // Autres fichiers
    return <File className="h-16 w-16 text-gray-500" />;
  };

  const getOcrBadge = () => {
    const ocrStatus = document.ocrStatus || 'unknown';
    
    const statusMap: Record<string, { variant: any; label: string; icon?: any }> = {
      completed: { variant: 'success', label: 'Traité', icon: CheckCircle },
      processed: { variant: 'success', label: 'Traité', icon: CheckCircle },
      success: { variant: 'success', label: 'Traité', icon: CheckCircle },
      failed: { variant: 'destructive', label: 'Échoué', icon: AlertCircle },
      pending: { variant: 'warning', label: 'En attente', icon: AlertCircle },
      unknown: { variant: 'secondary', label: 'N/A', icon: null },
    };

    const config = statusMap[ocrStatus] || { variant: 'secondary', label: 'Non traité', icon: null };
    const Icon = config.icon;
    
    // Ajouter le % directement dans le label si disponible
    let label = config.label;
    if (document.ocrConfidence && (ocrStatus === 'processed' || ocrStatus === 'completed' || ocrStatus === 'success')) {
      label = `${config.label} (${Math.round(document.ocrConfidence * 100)}%)`;
    }

    return (
      <Badge variant={config.variant}>
        {Icon && <Icon className="h-3 w-3 mr-1" />}
        {label}
      </Badge>
    );
  };

  const getLinkedToLabel = () => {
    if (document.DocumentLink && document.DocumentLink.length > 0) {
      return document.DocumentLink.map((link, index) => {
        const getEntityLabel = (linkedType: string) => {
          switch (linkedType) {
            case 'property': return 'Bien';
            case 'lease': return 'Bail';
            case 'tenant': return 'Locataire';
            case 'transaction': return 'Transaction';
            case 'global': return 'Global';
            default: return linkedType;
          }
        };

        return (
          <div key={link.id || index} className="flex items-center gap-2 text-sm">
            <LinkIcon className="h-3 w-3 text-gray-400" />
            <span className="text-gray-600">{getEntityLabel(link.linkedType)}</span>
            {link.entityName && (
              <span className="font-medium">- {link.entityName}</span>
            )}
          </div>
        );
      });
    }
    
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <LinkIcon className="h-3 w-3" />
        <span>Global</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl transform transition-transform">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-gray-50">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-gray-900 truncate">
                {document.filenameOriginal}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Informations du document
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Aperçu du document */}
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  {getDocumentIcon(document.mime)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate mb-2">
                    {document.filenameOriginal}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {document.DocumentType ? (
                      <Badge variant="default">{document.DocumentType.label}</Badge>
                    ) : (
                      <Badge variant="secondary">Non classé</Badge>
                    )}
                    {getOcrBadge()}
                  </div>
                </div>
              </div>

              {/* Métadonnées du fichier */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Informations du fichier</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Taille</p>
                    <p className="font-medium">{formatFileSize(document.size)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date d'upload</p>
                    <p className="font-medium">{formatDate(document.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Type MIME</p>
                    <p className="font-medium text-xs">{document.mime}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Statut OCR</p>
                    <div className="mt-1">
                      {getOcrBadge()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Liaisons */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                  <LinkIcon className="h-5 w-5" />
                  Lié à: {document.DocumentLink && document.DocumentLink.length > 1 ? `Multiple (${document.DocumentLink.length})` : document.DocumentLink && document.DocumentLink.length === 1 ? document.DocumentLink[0].linkedType : 'Global'}
                </h3>
                <div className="space-y-2">
                  {getLinkedToLabel()}
                </div>
              </div>

              {/* Texte extrait */}
              {document.extractedText && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Texte extrait (aperçu)
                  </h3>
                  <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {document.extractedText.length > 500 
                        ? `${document.extractedText.substring(0, 500)}...` 
                        : document.extractedText}
                    </p>
                  </div>
                </div>
              )}

              {/* Informations système */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Informations système</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">ID Document</p>
                    <p className="font-mono text-xs text-gray-500">{document.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Nom de fichier interne</p>
                    <p className="font-mono text-xs text-gray-500">{document.fileName}</p>
                  </div>
                  {document.userReason && (
                    <div>
                      <p className="text-sm text-gray-600">Raison utilisateur</p>
                      <p className="text-sm text-gray-700">{document.userReason}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
            <Button
              variant="outline"
              onClick={() => onDownload(document)}
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </Button>
            <Button
              variant="outline"
              onClick={() => onDelete(document)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

