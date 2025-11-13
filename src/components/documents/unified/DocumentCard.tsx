'use client';

import React from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  FileText,
  Image,
  File,
  Download,
  Trash2,
  Link as LinkIcon,
  History,
  Eye,
  Edit,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DocumentTableRow } from './DocumentTable';

interface DocumentCardProps {
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
  onClose?: () => void;
  onUpdate?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onRelink?: () => void;
  onEdit?: () => void;
  onViewVersions?: () => void;
}

export function DocumentCard({
  document,
  onClose,
  onUpdate,
  onDownload,
  onDelete,
  onRelink,
  onEdit,
  onViewVersions,
}: DocumentCardProps) {
  const getDocumentIcon = (mime: string) => {
    if (mime.includes('pdf')) return <FileText className="h-16 w-16 text-red-500" />;
    if (mime.includes('image')) return <Image className="h-16 w-16 text-blue-500" />;
    return <File className="h-16 w-16 text-gray-500" />;
  };

  const getStatusConfig = (status: string) => {
    const statusMap: Record<string, { variant: any; label: string; icon: any }> = {
      pending: { variant: 'warning', label: 'En attente', icon: Clock },
      classified: { variant: 'success', label: 'Classé', icon: CheckCircle },
      rejected: { variant: 'destructive', label: 'Rejeté', icon: AlertCircle },
      archived: { variant: 'secondary', label: 'Archivé', icon: AlertCircle },
    };

    return statusMap[status] || { variant: 'secondary', label: status, icon: AlertCircle };
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const statusConfig = getStatusConfig(document.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-xl">{document.filenameOriginal}</CardTitle>
            <CardDescription className="mt-2 flex items-center gap-2 flex-wrap">
              {document.DocumentType ? (
                <Badge variant="default">{document.DocumentType.label}</Badge>
              ) : (
                <Badge variant="secondary">Non classé</Badge>
              )}
              <Badge variant={statusConfig.variant}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusConfig.label}
              </Badge>
              {document.version && document.version > 1 && (
                <Badge variant="outline">v{document.version}</Badge>
              )}
              {document.userReason === 'doublon_conserve_manuellement' && (
                <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                  Copie autorisée manuellement
                </Badge>
              )}
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ×
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Aperçu */}
        <div className="flex items-center justify-center bg-gray-50 rounded-lg p-8">
          {document.mime.includes('image') && document.url ? (
            <img
              src={document.url}
              alt={document.filenameOriginal}
              className="max-h-64 rounded"
            />
          ) : (
            getDocumentIcon(document.mime)
          )}
        </div>

        {/* Informations principales */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Taille</span>
            <p className="font-medium">{formatFileSize(document.size)}</p>
          </div>
          <div>
            <span className="text-gray-600">Type MIME</span>
            <p className="font-medium">{document.mime}</p>
          </div>
          <div>
            <span className="text-gray-600">Date d'upload</span>
            <p className="font-medium">
              {format(new Date(document.createdAt), 'dd MMM yyyy HH:mm', { locale: fr })}
            </p>
          </div>
          <div>
            <span className="text-gray-600">Statut OCR</span>
            <p className="font-medium">
              {document.ocrStatus === 'success' ? (
                <span className="text-green-600">✓ Traité</span>
              ) : document.ocrStatus === 'failed' ? (
                <span className="text-red-600">✗ Échec</span>
              ) : (
                <span className="text-gray-500">En attente</span>
              )}
              {document.ocrConfidence && (
                <span className="text-xs text-gray-500 ml-2">
                  ({(document.ocrConfidence * 100).toFixed(0)}%)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Liaison */}
        {(() => {
          // Utiliser le nouveau système de liens polymorphiques
          if (document.DocumentLink && document.DocumentLink.length > 0) {
            if (document.DocumentLink.length === 1) {
              // Une seule liaison - afficher le détail
              const link = document.DocumentLink[0];
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
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <LinkIcon className="h-4 w-4 text-blue-600" />
                    <span className="text-gray-700 font-medium">Lié à:</span>
                    <span className="text-gray-900">
                      {getEntityLabel(link.linkedType)}
                      {link.entityName && ` - ${link.entityName}`}
                    </span>
                  </div>
                </div>
              );
            } else {
              // Plusieurs liaisons - afficher la liste complète
              return (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <LinkIcon className="h-4 w-4 text-blue-600" />
                    <span className="text-gray-700 font-medium">Lié à:</span>
                    <span className="text-gray-900 font-medium">Multiple ({document.DocumentLink.length})</span>
                  </div>
                  <div className="space-y-1 ml-6">
                    {document.DocumentLink.map((link, index) => {
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
                        <div key={index} className="text-sm text-gray-700">
                          • {getEntityLabel(link.linkedType)}
                          {link.entityName && ` - ${link.entityName}`}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }
          }

          // Fallback sur l'ancien système pour compatibilité
          if (document.linkedTo || document.Property || document.lease || document.transaction) {
            return (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <LinkIcon className="h-4 w-4 text-blue-600" />
                  <span className="text-gray-700 font-medium">Lié à:</span>
                  {document.Property && (
                    <span className="text-gray-900">Bien - {document.Property.name}</span>
                  )}
                  {document.lease && <span className="text-gray-900">Bail</span>}
                  {document.transaction && (
                    <span className="text-gray-900">Transaction - {document.transaction.label}</span>
                  )}
                  {!document.Property && !document.lease && !document.transaction && (
                    <span className="text-gray-500">Global</span>
                  )}
                </div>
              </div>
            );
          }

          return null;
        })()}

        {/* Champs extraits */}
        {document.DocumentField && document.DocumentField.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Champs extraits</h4>
            <div className="space-y-2">
              {document.DocumentField.map((field, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600">{field.fieldName}</span>
                  <span className="font-medium">
                    {field.valueText}
                    {field.confidence && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({(field.confidence * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rappels */}
        {document.reminders && document.reminders.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Rappels</h4>
            <div className="space-y-2">
              {document.reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  className="p-2 border border-orange-200 bg-orange-50 rounded text-sm"
                >
                  <div className="font-medium text-gray-900">{reminder.title}</div>
                  <div className="text-gray-600 text-xs mt-1">
                    {formatDistanceToNow(new Date(reminder.dueDate), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Texte extrait (aperçu) */}
        {document.extractedText && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Texte extrait (aperçu)</h4>
            <div className="p-3 bg-gray-50 rounded text-sm text-gray-700 max-h-32 overflow-y-auto">
              {document.extractedText.substring(0, 300)}
              {document.extractedText.length > 300 && '...'}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          {onDownload && (
            <Button variant="outline" onClick={onDownload}>
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
          )}
          {onViewVersions && document.version && document.version > 1 && (
            <Button variant="outline" onClick={onViewVersions}>
              <History className="h-4 w-4 mr-2" />
              Historique
            </Button>
          )}
          {onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

